import type { Problem } from "../core/problem.ts";

export class KempeChain {
  readonly lessons: Int32Array;
  readonly from: Int32Array;
  private readonly problem: Problem;
  private readonly mark: Int32Array;
  private stamp = 0;

  constructor(problem: Problem) {
    this.problem = problem;
    this.lessons = new Int32Array(problem.nLessons);
    this.from = new Int32Array(problem.nLessons);
    this.mark = new Int32Array(problem.nLessons);
  }

  build(slotOf: Int32Array, lesson: number, slot: number): number {
    const { adjStart, adjList } = this.problem;
    const { lessons, from, mark } = this;
    const home = slotOf[lesson];
    const stamp = ++this.stamp;
    lessons[0] = lesson;
    from[0] = home;
    mark[lesson] = stamp;
    let length = 1;
    for (let i = 0; i < length; i++) {
      const current = lessons[i];
      const target = from[i] === home ? slot : home;
      for (let k = adjStart[current]; k < adjStart[current + 1]; k++) {
        const other = adjList[k];
        if (slotOf[other] !== target || mark[other] === stamp) continue;
        mark[other] = stamp;
        lessons[length] = other;
        from[length] = target;
        length++;
      }
    }
    return length;
  }
}
