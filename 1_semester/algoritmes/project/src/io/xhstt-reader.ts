import type { Instance, Requirement, SchoolClass, Subject, Teacher } from "../model.ts";
import { Xml, type XmlNode } from "./xml.ts";

export interface XhsttReport {
  id: string;
  name: string;
  country: string;
  times: number;
  days: number;
  periodsPerDay: number;
  classes: number;
  teachers: number;
  otherResources: Record<string, number>;
  events: number;
  eventsUsed: number;
  eventsSkipped: Record<string, number>;
  lessons: number;
  lessonsSkipped: number;
  unassignedRoles: number;
  constraintsUsed: Record<string, number>;
  constraintsIgnored: Record<string, number>;
  notes: string[];
}

export interface XhsttResult {
  instance: Instance | undefined;
  report: XhsttReport;
}

const NEUTRAL_DIFFICULTY = 7;

export class XhsttReader {
  static instanceNodes(document: XmlNode): XmlNode[] {
    const archive = Xml.child(document, "HighSchoolTimetableArchive") ?? document;
    const instances = Xml.child(archive, "Instances");
    return instances ? Xml.all(instances, "Instance") : Xml.all(archive, "Instance");
  }

  static solutionNodes(document: XmlNode): XmlNode[] {
    const archive = document.children.find((child) => child.name.endsWith("Archive")) ?? document;
    return Xml.all(Xml.child(archive, "SolutionGroups"), "SolutionGroup").flatMap((group) => Xml.all(group, "Solution"));
  }

  static reportedCosts(document: XmlNode): { infeasibility: number; objective: number }[] {
    return XhsttReader.solutionNodes(document)
      .map((solution) => Xml.child(solution, "Report"))
      .filter((report) => report !== undefined)
      .map((report) => ({
        infeasibility: Number(Xml.text(report, "InfeasibilityValue")),
        objective: Number(Xml.text(report, "ObjectiveValue")),
      }));
  }

  static convert(node: XmlNode): XhsttResult {
    const meta = Xml.child(node, "MetaData");
    const report: XhsttReport = {
      id: node.attributes.Id ?? "",
      name: Xml.text(meta, "Name"),
      country: Xml.text(meta, "Country"),
      times: 0,
      days: 0,
      periodsPerDay: 0,
      classes: 0,
      teachers: 0,
      otherResources: {},
      events: 0,
      eventsUsed: 0,
      eventsSkipped: {},
      lessons: 0,
      lessonsSkipped: 0,
      unassignedRoles: 0,
      constraintsUsed: {},
      constraintsIgnored: {},
      notes: [],
    };
    const bump = (counts: Record<string, number>, key: string, by = 1) => {
      counts[key] = (counts[key] ?? 0) + by;
    };

    const times = Xml.child(node, "Times");
    const dayIds = Xml.all(Xml.child(times, "TimeGroups"), "Day").map((day) => day.attributes.Id);
    const perDay = new Map<string, string[]>(dayIds.map((id) => [id, []]));
    const timeSlot = new Map<string, [day: number, period: number]>();
    let withoutDay = 0;
    for (const time of Xml.all(times, "Time")) {
      report.times++;
      const day = Xml.child(time, "Day")?.attributes.Reference;
      const list = day === undefined ? undefined : perDay.get(day);
      if (!list) {
        withoutDay++;
        continue;
      }
      timeSlot.set(time.attributes.Id, [dayIds.indexOf(day!), list.length]);
      list.push(time.attributes.Id);
    }
    const lengths = [...perDay.values()].map((list) => list.length);
    report.days = dayIds.length;
    report.periodsPerDay = lengths.length ? Math.max(...lengths) : 0;
    if (withoutDay > 0) report.notes.push(`${withoutDay} times are not attached to a day`);
    const uneven = lengths.some((length) => length !== report.periodsPerDay);
    if (uneven) report.notes.push(`days have different lengths (${lengths.join(", ")}): missing periods are closed for every teacher`);

    const resources = Xml.child(node, "Resources");
    const typeKind = new Map<string, "class" | "teacher" | "other">();
    for (const type of Xml.all(Xml.child(resources, "ResourceTypes"), "ResourceType")) {
      const label = `${type.attributes.Id} ${Xml.text(type, "Name")}`.toLowerCase();
      typeKind.set(type.attributes.Id, label.includes("class") ? "class" : label.includes("teacher") ? "teacher" : "other");
    }
    const kindOf = new Map<string, "class" | "teacher" | "other">();
    const classes: SchoolClass[] = [];
    const teachers: Teacher[] = [];
    for (const resource of Xml.all(resources, "Resource")) {
      const type = Xml.child(resource, "ResourceType")?.attributes.Reference ?? "";
      const kind = typeKind.get(type) ?? "other";
      kindOf.set(resource.attributes.Id, kind);
      if (kind === "class") classes.push({ id: resource.attributes.Id, grade: 0, firstPeriod: 0, maxPerDay: report.periodsPerDay });
      else if (kind === "teacher") teachers.push({ id: resource.attributes.Id });
      else bump(report.otherResources, type);
    }

    const subjects = new Map<string, Subject>();
    const requirements: Requirement[] = [];
    const dummyTeachers = new Set<string>();
    for (const event of Xml.all(Xml.child(node, "Events"), "Event")) {
      report.events++;
      const duration = Number(Xml.text(event, "Duration") || "1");
      const eventClasses: string[] = [];
      const eventTeachers: string[] = [];
      for (const resource of Xml.all(Xml.child(event, "Resources"), "Resource")) {
        const reference = resource.attributes.Reference;
        if (reference === undefined) {
          report.unassignedRoles++;
          continue;
        }
        const kind = kindOf.get(reference);
        if (kind === "class") eventClasses.push(reference);
        else if (kind === "teacher") eventTeachers.push(reference);
      }
      const skip = (reason: string) => {
        bump(report.eventsSkipped, reason);
        report.lessonsSkipped += duration;
      };
      if (eventClasses.length === 0) {
        skip("no class");
        continue;
      }
      if (eventClasses.length > 1) {
        skip("several classes");
        continue;
      }
      if (Xml.child(event, "Time")) bump(report.constraintsIgnored, "preassigned time");
      if (eventTeachers.length === 0) {
        const dummy = `no-teacher-${eventClasses[0]}`;
        dummyTeachers.add(dummy);
        eventTeachers.push(dummy);
      }
      const subject = Xml.child(event, "Course")?.attributes.Reference ?? event.attributes.Id;
      if (!subjects.has(subject)) subjects.set(subject, { id: subject, difficulty: NEUTRAL_DIFFICULTY });
      requirements.push({ class: eventClasses[0], subject, teachers: [...new Set(eventTeachers)], hours: duration });
      report.eventsUsed++;
      report.lessons += duration;
    }
    for (const id of dummyTeachers) teachers.push({ id });
    if (dummyTeachers.size > 0) report.notes.push(`${dummyTeachers.size} classes have lessons without a teacher: a placeholder teacher is used`);
    if (report.unassignedRoles > 0) report.notes.push(`${report.unassignedRoles} roles are left for the solver to assign (rooms or teachers): ignored`);

    const closed = new Map<string, Set<number>>();
    const close = (teacher: string, day: number, period: number) => {
      const set = closed.get(teacher) ?? new Set<number>();
      closed.set(teacher, set);
      set.add(day * report.periodsPerDay + period);
    };
    for (const constraint of Xml.child(node, "Constraints")?.children ?? []) {
      const required = Xml.text(constraint, "Required") === "true";
      if (constraint.name === "AssignTimeConstraint" || constraint.name === "AvoidClashesConstraint") {
        bump(required ? report.constraintsUsed : report.constraintsIgnored, constraint.name);
        continue;
      }
      if (constraint.name !== "AvoidUnavailableTimesConstraint" || !required) {
        bump(report.constraintsIgnored, required ? constraint.name : `${constraint.name} (soft)`);
        continue;
      }
      const applies = Xml.child(constraint, "AppliesTo");
      const targets = Xml.all(Xml.child(applies, "Resources"), "Resource").map((r) => r.attributes.Reference);
      if (Xml.child(applies, "ResourceGroups")) report.notes.push("unavailable times given for a resource group: ignored");
      const slots = Xml.all(Xml.child(constraint, "Times"), "Time")
        .map((time) => timeSlot.get(time.attributes.Reference))
        .filter((slot): slot is [number, number] => slot !== undefined);
      let used = false;
      for (const target of targets) {
        if (kindOf.get(target) !== "teacher") continue;
        used = true;
        for (const [day, period] of slots) close(target, day, period);
      }
      bump(used ? report.constraintsUsed : report.constraintsIgnored, used ? constraint.name : `${constraint.name} (not a teacher)`);
    }
    if (uneven) {
      [...perDay.values()].forEach((list, day) => {
        for (const teacher of teachers) for (let p = list.length; p < report.periodsPerDay; p++) close(teacher.id, day, p);
      });
    }
    for (const teacher of teachers) {
      const set = closed.get(teacher.id);
      if (!set) continue;
      teacher.unavailable = [...set]
        .sort((a, b) => a - b)
        .map((slot) => [Math.floor(slot / report.periodsPerDay), slot % report.periodsPerDay]);
    }

    report.classes = classes.length;
    report.teachers = teachers.length - dummyTeachers.size;
    const usedClasses = new Set(requirements.map((r) => r.class));
    const usedTeachers = new Set(requirements.flatMap((r) => r.teachers));
    if (requirements.length === 0 || report.days === 0 || report.periodsPerDay === 0) {
      report.notes.push("no lessons with a single class: the instance does not fit the model");
      return { instance: undefined, report };
    }
    const instance: Instance = {
      name: report.id,
      days: report.days,
      periodsPerDay: report.periodsPerDay,
      subjects: [...subjects.values()],
      teachers: teachers.filter((teacher) => usedTeachers.has(teacher.id)),
      classes: classes.filter((cls) => usedClasses.has(cls.id)),
      requirements,
    };
    return { instance, report };
  }

}
