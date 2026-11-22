import { EASY_UP_TO, HEAVY_FROM } from "../../src/core/cost.ts";
import type { Problem } from "../../src/core/problem.ts";
import { UNASSIGNED } from "../../src/model.ts";

const REASONS = ["the same subject twice this day", "an easy lesson in the first half of the day", "a hard lesson in the second half of the day", "at a time its teacher asked to avoid"];

export class Trouble {
  static of(problem: Problem, slotOf: Int32Array): Uint8Array {
    const { nLessons, nSlots, nClasses, nSubjects, days, periods, lessonClass, lessonSubject } = problem;
    const flags = new Uint8Array(nLessons);
    const score = problem.instance.subjects.map((subject) => subject.difficulty);
    const sameDay = new Uint8Array(nClasses * days * nSubjects);
    const busy = new Uint8Array(nClasses * nSlots);
    for (let lesson = 0; lesson < nLessons; lesson++) {
      const slot = slotOf[lesson];
      if (slot === UNASSIGNED) continue;
      sameDay[(lessonClass[lesson] * days + problem.dayOf(slot)) * nSubjects + lessonSubject[lesson]]++;
      busy[lessonClass[lesson] * nSlots + slot] = 1;
    }
    const rank = new Uint8Array(nClasses * nSlots);
    const load = new Uint8Array(nClasses * days);
    for (let cls = 0; cls < nClasses; cls++) {
      for (let day = 0; day < days; day++) {
        let count = 0;
        for (let period = 0; period < periods; period++) {
          const cell = cls * nSlots + day * periods + period;
          if (busy[cell]) rank[cell] = count++;
        }
        load[cls * days + day] = count;
      }
    }
    for (let lesson = 0; lesson < nLessons; lesson++) {
      const slot = slotOf[lesson];
      if (slot === UNASSIGNED) continue;
      const cls = lessonClass[lesson];
      const day = problem.dayOf(slot);
      const subject = lessonSubject[lesson];
      const index = rank[cls * nSlots + slot];
      const lessons = load[cls * days + day];
      let flag = sameDay[(cls * days + day) * nSubjects + subject] > 1 ? 1 : 0;
      if (index < Math.floor(lessons / 2) && score[subject] <= EASY_UP_TO) flag |= 2;
      if (index >= Math.ceil(lessons / 2) && score[subject] >= HEAVY_FROM) flag |= 4;
      for (const teacher of problem.teachersOf(lesson)) if (problem.teacherWished[teacher * periods + problem.periodOf(slot)]) flag |= 8;
      flags[lesson] = flag;
    }
    return flags;
  }

  static reasons(flag: number): string[] {
    return REASONS.filter((_, bit) => (flag & (1 << bit)) !== 0);
  }

  static count(flags: Uint8Array): number {
    let total = 0;
    for (const flag of flags) if (flag > 0) total++;
    return total;
  }
}
