import type { XmlNode } from "./xhstt.ts";

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
}

export class XhsttEvaluator {
  static evaluate(instance: XmlNode, solution: XmlNode): XhsttCost {
    const child = (node: XmlNode | undefined, name: string) => node?.children.find((c) => c.name === name);
    const all = (node: XmlNode | undefined, name: string) => node?.children.filter((c) => c.name === name) ?? [];
    const text = (node: XmlNode | undefined, name: string) => child(node, name)?.text ?? "";
    const refs = (node: XmlNode | undefined, wrapper: string, tag: string) => all(child(node, wrapper), tag).map((n) => n.attributes.Reference);

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

    const assigned = new Map<string, number>();
    for (const event of all(child(solution, "Events"), "Event")) {
      const time = child(event, "Time")?.attributes.Reference;
      if (time !== undefined && timeIndex.has(time)) assigned.set(event.attributes.Reference, timeIndex.get(time)!);
    }

    const lessons: Lesson[] = [];
    const eventsOfGroup = new Map<string, Lesson[]>();
    const busy = new Map<string, Int32Array>();
    for (const event of all(child(instance, "Events"), "Event")) {
      if (text(event, "Duration") !== "1") throw new Error("only events of duration 1 are supported");
      const lesson: Lesson = {
        id: event.attributes.Id,
        resources: all(child(event, "Resources"), "Resource").map((r) => r.attributes.Reference),
        groups: refs(event, "EventGroups", "EventGroup"),
        time: assigned.get(event.attributes.Id) ?? -1,
      };
      if (lesson.resources.some((r) => r === undefined)) throw new Error("only preassigned resources are supported");
      const course = child(event, "Course")?.attributes.Reference;
      if (course !== undefined) lesson.groups.push(course);
      lessons.push(lesson);
      for (const group of lesson.groups) {
        const list = eventsOfGroup.get(group) ?? [];
        eventsOfGroup.set(group, list);
        list.push(lesson);
      }
      if (lesson.time < 0) continue;
      for (const resource of lesson.resources) {
        const counts = busy.get(resource) ?? new Int32Array(nTimes);
        busy.set(resource, counts);
        counts[lesson.time]++;
      }
    }
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
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
        const targets = [
          ...refs(applies, "EventGroups", "EventGroup").flatMap((group) => eventsOfGroup.get(group) ?? []),
          ...refs(applies, "Events", "Event").map((id) => lessonById.get(id)!),
        ];
        for (const lesson of targets) deviations.push(lesson.time < 0 ? 1 : 0);
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
