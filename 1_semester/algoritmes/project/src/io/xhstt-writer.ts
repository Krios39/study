import { Weights, type CostWeights } from "../core/cost.ts";
import { Problem } from "../core/problem.ts";
import { UNASSIGNED, type Instance, type Solution } from "../model.ts";

export interface XhsttSolution {
  description: string;
  slotOf: Solution;
}

export type XhsttEventStyle = "lessons" | "courses";

export const XHSTT_EXPORT_WEIGHTS = Weights.without("difficulty", "dayImbalance", "dayLoadSquare", "misplaced", "shiftIdle");

export class XhsttWriter {
  private readonly lines: string[] = [];
  private depth = 0;

  static archive(
    instance: Instance,
    solutions: XhsttSolution[] = [],
    weights: Partial<CostWeights> = {},
    style: XhsttEventStyle = "lessons",
  ): string {
    const writer = new XhsttWriter();
    writer.write(instance, solutions, Weights.resolve(weights), style);
    return writer.lines.join("\n") + "\n";
  }

  private static escape(value: string | number): string {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  private open(name: string, attributes: Record<string, string | number> = {}) {
    this.lines.push(`${"\t".repeat(this.depth)}<${name}${this.attrs(attributes)}>`);
    this.depth++;
  }

  private close(name: string) {
    this.depth--;
    this.lines.push(`${"\t".repeat(this.depth)}</${name}>`);
  }

  private leaf(name: string, text: string | number) {
    this.lines.push(`${"\t".repeat(this.depth)}<${name}>${XhsttWriter.escape(text)}</${name}>`);
  }

  private empty(name: string, attributes: Record<string, string | number>) {
    this.lines.push(`${"\t".repeat(this.depth)}<${name}${this.attrs(attributes)}/>`);
  }

  private attrs(attributes: Record<string, string | number>): string {
    return Object.entries(attributes)
      .map(([key, value]) => ` ${key}="${XhsttWriter.escape(value)}"`)
      .join("");
  }

  private named(tag: string, id: string, body: () => void = () => {}) {
    this.open(tag, { Id: id });
    this.leaf("Name", id);
    body();
    this.close(tag);
  }

  private constraint(
    tag: string,
    id: string,
    required: boolean,
    weight: number,
    costFunction: "Linear" | "Quadratic" | "Step",
    body: () => void,
  ) {
    this.open(tag, { Id: id });
    this.leaf("Name", id);
    this.leaf("Required", required ? "true" : "false");
    this.leaf("Weight", weight);
    this.leaf("CostFunction", costFunction);
    body();
    this.close(tag);
  }

  private references(wrapper: string, tag: string, ids: string[]) {
    this.open(wrapper);
    for (const id of ids) this.empty(tag, { Reference: id });
    this.close(wrapper);
  }

  private write(instance: Instance, solutions: XhsttSolution[], weights: CostWeights, style: XhsttEventStyle) {
    const problem = Problem.from(instance);
    const { days, periods } = problem;
    const shiftCount = Math.max(...problem.periodShift) + 1;
    const dayId = (d: number) => `day${d + 1}`;
    const shiftId = (d: number, k: number) => `day${d + 1}_shift${k + 1}`;
    const timeId = (d: number, p: number) => `d${d + 1}_p${p + 1}`;
    const courseId = (r: number) => `course${r + 1}`;
    const eventId = (l: number) => (style === "courses" ? `subject${problem.lessonReq[l] + 1}` : `lesson${l + 1}`);
    const firstLesson = new Map<number, number>();
    for (let l = problem.nLessons - 1; l >= 0; l--) firstLesson.set(problem.lessonReq[l], l);
    const eventLessons = style === "courses" ? [...firstLesson.values()].sort((a, b) => a - b) : Array.from({ length: problem.nLessons }, (_, l) => l);
    const everyDay = Array.from({ length: days }, (_, d) => d);
    const everyPeriod = Array.from({ length: periods }, (_, p) => p);

    this.open("HighSchoolTimetableArchive", { Id: `${instance.name}-archive` });
    this.open("Instances");
    this.open("Instance", { Id: instance.name });
    this.open("MetaData");
    this.leaf("Name", instance.name);
    this.leaf("Contributor", "school timetabling project");
    this.leaf("Date", "-");
    this.leaf("Country", "Kazakhstan");
    this.leaf("Description", "Exported from the project instance format; only the constraints that XHSTT expresses exactly are included");
    this.close("MetaData");

    this.open("Times");
    this.open("TimeGroups");
    for (const d of everyDay) this.named("Day", dayId(d));
    for (const d of everyDay) for (let k = 0; k < shiftCount; k++) this.named("TimeGroup", shiftId(d, k));
    this.close("TimeGroups");
    for (const d of everyDay) {
      for (const p of everyPeriod) {
        this.named("Time", timeId(d, p), () => {
          this.empty("Day", { Reference: dayId(d) });
          this.references("TimeGroups", "TimeGroup", [shiftId(d, problem.periodShift[p])]);
        });
      }
    }
    this.close("Times");

    this.open("Resources");
    this.open("ResourceTypes");
    this.named("ResourceType", "Teacher");
    this.named("ResourceType", "Class");
    this.close("ResourceTypes");
    this.open("ResourceGroups");
    this.named("ResourceGroup", "gr_Teachers", () => this.empty("ResourceType", { Reference: "Teacher" }));
    this.named("ResourceGroup", "gr_Classes", () => this.empty("ResourceType", { Reference: "Class" }));
    this.close("ResourceGroups");
    for (const teacher of instance.teachers) {
      this.named("Resource", teacher.id, () => {
        this.empty("ResourceType", { Reference: "Teacher" });
        this.references("ResourceGroups", "ResourceGroup", ["gr_Teachers"]);
      });
    }
    for (const cls of instance.classes) {
      this.named("Resource", cls.id, () => {
        this.empty("ResourceType", { Reference: "Class" });
        this.references("ResourceGroups", "ResourceGroup", ["gr_Classes"]);
      });
    }
    this.close("Resources");

    this.open("Events");
    this.open("EventGroups");
    instance.requirements.forEach((_, r) => this.named("Course", courseId(r)));
    this.named("EventGroup", "gr_AllEvents");
    this.close("EventGroups");
    for (const l of eventLessons) {
      const requirement = instance.requirements[problem.lessonReq[l]];
      this.named("Event", eventId(l), () => {
        this.leaf("Duration", style === "courses" ? requirement.hours : 1);
        this.empty("Course", { Reference: courseId(problem.lessonReq[l]) });
        this.open("Resources");
        this.open("Resource", { Reference: requirement.class });
        this.leaf("Role", "Class");
        this.empty("ResourceType", { Reference: "Class" });
        this.close("Resource");
        requirement.teachers.forEach((teacher, i) => {
          this.open("Resource", { Reference: teacher });
          this.leaf("Role", `Teacher${i + 1}`);
          this.empty("ResourceType", { Reference: "Teacher" });
          this.close("Resource");
        });
        this.close("Resources");
        this.references("EventGroups", "EventGroup", ["gr_AllEvents"]);
      });
    }
    this.close("Events");

    this.open("Constraints");
    this.constraint("AssignTimeConstraint", "AssignTimes", true, 1, "Linear", () => {
      this.open("AppliesTo");
      this.references("EventGroups", "EventGroup", ["gr_AllEvents"]);
      this.close("AppliesTo");
    });

    if (style === "courses") {
      this.constraint("SplitEventsConstraint", "SingleLessons", true, 1, "Linear", () => {
        this.open("AppliesTo");
        this.references("EventGroups", "EventGroup", ["gr_AllEvents"]);
        this.close("AppliesTo");
        this.leaf("MinimumDuration", 1);
        this.leaf("MaximumDuration", 1);
        this.leaf("MinimumAmount", 1);
        this.leaf("MaximumAmount", Math.max(...instance.requirements.map((r) => r.hours)));
      });
    }

    const repeated = instance.requirements.map((r, i) => (r.hours > 1 ? courseId(i) : "")).filter((id) => id.length > 0);
    if (repeated.length > 0 && weights.sameSubjectInDay > 0) {
      this.constraint("SpreadEventsConstraint", "OneLessonOfSubjectPerDay", false, weights.sameSubjectInDay, "Linear", () => {
        this.open("AppliesTo");
        this.references("EventGroups", "EventGroup", repeated);
        this.close("AppliesTo");
        this.open("TimeGroups");
        for (const d of everyDay) {
          this.open("TimeGroup", { Reference: dayId(d) });
          this.leaf("Minimum", 0);
          this.leaf("Maximum", 1);
          this.close("TimeGroup");
        }
        this.close("TimeGroups");
      });
    }

    this.constraint("AvoidClashesConstraint", "NoClashes", true, 1, "Linear", () => {
      this.open("AppliesTo");
      this.references("ResourceGroups", "ResourceGroup", ["gr_Teachers", "gr_Classes"]);
      this.close("AppliesTo");
    });

    const unavailable = (id: string, resource: string, required: boolean, weight: number, slots: [number, number][]) => {
      if (slots.length === 0) return;
      this.constraint("AvoidUnavailableTimesConstraint", id, required, weight, "Linear", () => {
        this.open("AppliesTo");
        this.references("Resources", "Resource", [resource]);
        this.close("AppliesTo");
        this.references("Times", "Time", slots.map(([d, p]) => timeId(d, p)));
      });
    };
    for (const teacher of instance.teachers) unavailable(`Unavailable_${teacher.id}`, teacher.id, true, 1, teacher.unavailable ?? []);
    for (const cls of instance.classes) {
      const outside: [number, number][] = [];
      for (const d of everyDay) for (const p of everyPeriod) if (p < cls.firstPeriod || p >= cls.firstPeriod + cls.maxPerDay) outside.push([d, p]);
      unavailable(`OutsideShift_${cls.id}`, cls.id, true, 1, outside);
    }
    if (weights.teacherWish > 0) {
      for (const teacher of instance.teachers) {
        if (!teacher.wish) continue;
        const wished: [number, number][] = [];
        for (const d of everyDay) for (let p = teacher.wish.periods[0]; p <= teacher.wish.periods[1]; p++) wished.push([d, p]);
        unavailable(`Wish_${teacher.id}`, teacher.id, false, weights.teacherWish, wished);
      }
    }

    const idle = (id: string, group: string, required: boolean, weight: number, fn: "Linear" | "Quadratic", timeGroups: string[]) => {
      this.constraint("LimitIdleTimesConstraint", id, required, weight, fn, () => {
        this.open("AppliesTo");
        this.references("ResourceGroups", "ResourceGroup", [group]);
        this.close("AppliesTo");
        this.references("TimeGroups", "TimeGroup", timeGroups);
        this.leaf("Minimum", 0);
        this.leaf("Maximum", 0);
      });
    };
    idle("NoClassGaps", "gr_Classes", true, 1, "Linear", everyDay.map(dayId));
    if (weights.teacherGap > 0) {
      const shifts = everyDay.flatMap((d) => Array.from({ length: shiftCount }, (_, k) => shiftId(d, k)));
      idle("TeacherGapsWithinShift", "gr_Teachers", false, weights.teacherGap, "Quadratic", shifts);
    }

    if (shiftCount > 1 && weights.shiftBreak > 0) {
      for (const d of everyDay) {
        this.constraint("ClusterBusyTimesConstraint", `OneShiftPerDay_${dayId(d)}`, false, weights.shiftBreak, "Linear", () => {
          this.open("AppliesTo");
          this.references("ResourceGroups", "ResourceGroup", ["gr_Teachers"]);
          this.close("AppliesTo");
          this.references("TimeGroups", "TimeGroup", Array.from({ length: shiftCount }, (_, k) => shiftId(d, k)));
          this.leaf("Minimum", 0);
          this.leaf("Maximum", 1);
        });
      }
    }
    this.close("Constraints");
    this.close("Instance");
    this.close("Instances");

    if (solutions.length > 0) {
      this.open("SolutionGroups");
      this.open("SolutionGroup", { Id: `${instance.name}-solutions` });
      this.open("MetaData");
      this.leaf("Contributor", "school timetabling project");
      this.leaf("Date", "-");
      this.leaf("Description", "Timetables produced by the project algorithms");
      this.close("MetaData");
      for (const solution of solutions) {
        this.open("Solution", { Reference: instance.name });
        this.leaf("Description", solution.description);
        this.open("Events");
        for (let l = 0; l < problem.nLessons; l++) {
          const slot = solution.slotOf[l];
          if (slot === UNASSIGNED) continue;
          this.open("Event", { Reference: eventId(l) });
          if (style === "courses") this.leaf("Duration", 1);
          this.empty("Time", { Reference: timeId(problem.dayOf(slot), problem.periodOf(slot)) });
          this.close("Event");
        }
        this.close("Events");
        this.close("Solution");
      }
      this.close("SolutionGroup");
      this.close("SolutionGroups");
    }
    this.close("HighSchoolTimetableArchive");
  }
}
