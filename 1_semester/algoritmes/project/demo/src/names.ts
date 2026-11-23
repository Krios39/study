import type { Problem } from "../../src/core/problem.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Lang } from "./text.ts";

const WEEK = 7;

export class Names {
  private readonly problem: Problem;
  private readonly titles: string[];
  private readonly codes: string[];

  constructor(problem: Problem) {
    this.problem = problem;
    const words = problem.instance.subjects.map((subject) => subject.id.split("_"));
    this.titles = problem.instance.subjects.map((subject) => Names.title(subject.id));
    this.codes = words.map((parts) =>
      Lang.has(`code.${parts.join("_")}`) ? Lang.t(`code.${parts.join("_")}`) : parts.length === 1 ? Names.capital(parts[0].slice(0, 4)) : Names.capital(parts[0].slice(0, 2)) + Names.capital(parts[1].slice(0, 2)),
    );
  }

  static day(day: number): string {
    return Lang.t(`day.${day % WEEK}`);
  }

  static title(subject: string): string {
    const key = `subject.${subject}`;
    return Lang.has(key) ? Lang.t(key) : Names.capital(subject.split("_").join(" "));
  }

  subject(lesson: number): string {
    return this.titles[this.problem.lessonSubject[lesson]];
  }

  code(lesson: number): string {
    return this.codes[this.problem.lessonSubject[lesson]];
  }

  className(lesson: number): string {
    return this.problem.instance.classes[this.problem.lessonClass[lesson]].id;
  }

  lesson(lesson: number): string {
    return `${this.className(lesson)} · ${this.subject(lesson)}`;
  }

  teachers(lesson: number): string {
    const { instance } = this.problem;
    return Array.from(this.problem.teachersOf(lesson), (teacher) => instance.teachers[teacher].id).join(", ");
  }

  slot(slot: number): string {
    if (slot === UNASSIGNED) return Lang.t("slot.unplaced");
    return Lang.t("slot.name", { day: Names.day(this.problem.dayOf(slot)), period: this.problem.periodOf(slot) + 1 });
  }

  private static capital(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
