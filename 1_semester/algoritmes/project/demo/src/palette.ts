import type { Problem } from "../../src/core/problem.ts";

export type ColourMode = "subject" | "difficulty";

const DARK_INK = "#14161a";
const LIGHT_INK = "#ffffff";

export class Palette {
  private readonly problem: Problem;
  private readonly fills: string[];
  private readonly inks: string[];

  constructor(problem: Problem, mode: ColourMode) {
    this.problem = problem;
    const { subjects } = problem.instance;
    const hardest = Math.max(...subjects.map((subject) => subject.difficulty));
    const lightness = subjects.map((_, index) =>
      mode === "subject" ? (index % 2 === 0 ? 58 : 68) : (index % 2 === 0 ? 62 : 54),
    );
    const hue = subjects.map((subject) => Math.round(125 - (125 * (subject.difficulty - 1)) / Math.max(1, hardest - 1)));
    this.fills = subjects.map((_, index) =>
      mode === "subject" ? `hsl(${Math.round((index * 137.5) % 360)} 62% ${lightness[index]}%)` : `hsl(${hue[index]} 70% ${Math.round(lightness[index])}%)`,
    );
    this.inks = lightness.map((value) => (value < 50 ? LIGHT_INK : DARK_INK));
  }

  fill(lesson: number): string {
    return this.fills[this.problem.lessonSubject[lesson]];
  }

  ink(lesson: number): string {
    return this.inks[this.problem.lessonSubject[lesson]];
  }
}
