import { Xml, type XmlNode } from "./xml.ts";

export interface XhsttCost {
  infeasibility: number;
  objective: number;
  byConstraint: Record<string, number>;
}

interface Lesson {
  id: string;
  resources: string[];
  groups: string[];
  time: number;
  duration: number;
}

interface Course {
  id: string;
  duration: number;
  groups: string[];
  parts: Lesson[];
}

export class XhsttEvaluator {
  static evaluate(instance: XmlNode, solution: XmlNode): XhsttCost {
    const { child, all, text, references: refs } = Xml;

    const times = child(instance, "Times");
    const timeIndex = new Map<string, number>();
    const groupTimes = new Map<string, number[]>();
    for (const group of child(times, "TimeGroups")?.children ?? []) groupTimes.set(group.attributes.Id, []);
    all(times, "Time").forEach((time, index) => {
      timeIndex.set(time.attributes.Id, index);
      const groups = [child(time, "Week"), child(time, "Day"), ...all(child(time, "TimeGroups"), "TimeGroup")];
      for (const group of groups) if (group) groupTimes.get(group.attributes.Reference)?.push(index);
    });
    const nTimes = timeIndex.size;

    const resources = child(instance, "Resources");
    const resourceGroups = new Map<string, string[]>();
    for (const group of all(child(resources, "ResourceGroups"), "ResourceGroup")) resourceGroups.set(group.attributes.Id, []);
    for (const resource of all(resources, "Resource")) {
      for (const group of refs(resource, "ResourceGroups", "ResourceGroup")) resourceGroups.get(group)?.push(resource.attributes.Id);
    }

    const solved = new Map<string, { time: number; duration: number | undefined }[]>();
    for (const event of all(child(solution, "Events"), "Event")) {
      const reference = child(event, "Time")?.attributes.Reference;
      const duration = text(event, "Duration");
      const list = solved.get(event.attributes.Reference) ?? [];
      solved.set(event.attributes.Reference, list);
      list.push({
        time: reference !== undefined && timeIndex.has(reference) ? timeIndex.get(reference)! : -1,
        duration: duration === "" ? undefined : Number(duration),
      });
    }

    const courses: Course[] = [];
    const eventsOfGroup = new Map<string, Lesson[]>();
    const coursesOfGroup = new Map<string, Course[]>();
    const busy = new Map<string, Int32Array>();
    for (const event of all(child(instance, "Events"), "Event")) {
      const resources = all(child(event, "Resources"), "Resource").map((r) => r.attributes.Reference);
      if (resources.some((r) => r === undefined)) throw new Error("only preassigned resources are supported");
      const groups = refs(event, "EventGroups", "EventGroup");
      const courseGroup = child(event, "Course")?.attributes.Reference;
      if (courseGroup !== undefined) groups.push(courseGroup);
      const total = Number(text(event, "Duration") || "1");
      const given = solved.get(event.attributes.Id) ?? [{ time: -1, duration: total }];
      const course: Course = { id: event.attributes.Id, duration: total, groups, parts: [] };
      for (const part of given) {
        course.parts.push({ id: event.attributes.Id, resources, groups, time: part.time, duration: part.duration ?? total });
      }
      courses.push(course);
      for (const group of groups) {
        coursesOfGroup.set(group, [...(coursesOfGroup.get(group) ?? []), course]);
        const list = eventsOfGroup.get(group) ?? [];
        eventsOfGroup.set(group, list);
        list.push(...course.parts);
      }
      for (const lesson of course.parts) {
        if (lesson.time < 0) continue;
        for (const resource of resources) {
          const counts = busy.get(resource) ?? new Int32Array(nTimes);
          busy.set(resource, counts);
          for (let k = 0; k < lesson.duration && lesson.time + k < nTimes; k++) counts[lesson.time + k]++;
        }
      }
    }
    const courseById = new Map(courses.map((course) => [course.id, course]));
    const appliedCourses = (applies: XmlNode | undefined) => [
      ...refs(applies, "EventGroups", "EventGroup").flatMap((group) => coursesOfGroup.get(group) ?? []),
      ...refs(applies, "Events", "Event").map((id) => courseById.get(id)!),
    ];
    const empty = new Int32Array(nTimes);
    const busyOf = (resource: string) => busy.get(resource) ?? empty;

    const result: XhsttCost = { infeasibility: 0, objective: 0, byConstraint: {} };
    const limit = (value: number, minimum: number, maximum: number) => (value < minimum ? minimum - value : value > maximum ? value - maximum : 0);
    for (const constraint of child(instance, "Constraints")?.children ?? []) {
      const required = text(constraint, "Required") === "true";
      const weight = Number(text(constraint, "Weight"));
      const fn = text(constraint, "CostFunction");
      const applies = child(constraint, "AppliesTo");
      const minimum = Number(text(constraint, "Minimum") || "0");
      const maximum = Number(text(constraint, "Maximum") || "0");
      const appliedResources = [
        ...refs(applies, "ResourceGroups", "ResourceGroup").flatMap((group) => resourceGroups.get(group) ?? []),
        ...refs(applies, "Resources", "Resource"),
      ];
      const groups = refs(constraint, "TimeGroups", "TimeGroup").map((group) => groupTimes.get(group) ?? []);
      const deviations: number[] = [];

      if (constraint.name === "AssignTimeConstraint") {
        for (const course of appliedCourses(applies)) {
          let placed = 0;
          for (const part of course.parts) if (part.time >= 0) placed += part.duration;
          deviations.push(Math.max(0, course.duration - placed));
        }
      } else if (constraint.name === "SplitEventsConstraint") {
        const minDuration = Number(text(constraint, "MinimumDuration"));
        const maxDuration = Number(text(constraint, "MaximumDuration"));
        const minAmount = Number(text(constraint, "MinimumAmount"));
        const maxAmount = Number(text(constraint, "MaximumAmount"));
        for (const course of appliedCourses(applies)) {
          let deviation = limit(course.parts.length, minAmount, maxAmount);
          for (const part of course.parts) if (part.duration < minDuration || part.duration > maxDuration) deviation++;
          deviations.push(deviation);
        }
      } else if (constraint.name === "SpreadEventsConstraint") {
        const limits = all(child(constraint, "TimeGroups"), "TimeGroup").map((group) => ({
          times: new Set(groupTimes.get(group.attributes.Reference) ?? []),
          minimum: Number(text(group, "Minimum")),
          maximum: Number(text(group, "Maximum")),
        }));
        for (const group of refs(applies, "EventGroups", "EventGroup")) {
          let deviation = 0;
          for (const { times: set, minimum: lo, maximum: hi } of limits) {
            let count = 0;
            for (const lesson of eventsOfGroup.get(group) ?? []) if (lesson.time >= 0 && set.has(lesson.time)) count++;
            deviation += limit(count, lo, hi);
          }
          deviations.push(deviation);
        }
      } else if (constraint.name === "AvoidClashesConstraint") {
        for (const resource of appliedResources) {
          let deviation = 0;
          for (const count of busyOf(resource)) if (count > 1) deviation += count - 1;
          deviations.push(deviation);
        }
      } else if (constraint.name === "AvoidUnavailableTimesConstraint") {
        const closed = refs(constraint, "Times", "Time").map((id) => timeIndex.get(id)!);
        for (const resource of appliedResources) {
          const counts = busyOf(resource);
          deviations.push(closed.filter((time) => counts[time] > 0).length);
        }
      } else if (constraint.name === "LimitIdleTimesConstraint") {
        for (const resource of appliedResources) {
          const counts = busyOf(resource);
          let idle = 0;
          for (const group of groups) {
            const busyTimes = group.filter((time) => counts[time] > 0);
            if (busyTimes.length > 0) idle += busyTimes[busyTimes.length - 1] - busyTimes[0] + 1 - busyTimes.length;
          }
          deviations.push(limit(idle, minimum, maximum));
        }
      } else if (constraint.name === "ClusterBusyTimesConstraint") {
        for (const resource of appliedResources) {
          const counts = busyOf(resource);
          const active = groups.filter((group) => group.some((time) => counts[time] > 0)).length;
          deviations.push(limit(active, minimum, maximum));
        }
      } else {
        throw new Error(`constraint ${constraint.name} is not supported`);
      }

      let cost = 0;
      for (const deviation of deviations) cost += weight * (fn === "Quadratic" ? deviation * deviation : fn === "Step" ? Math.min(1, deviation) : deviation);
      result.byConstraint[constraint.attributes.Id] = cost;
      if (required) result.infeasibility += cost;
      else result.objective += cost;
    }
    return result;
  }
}
