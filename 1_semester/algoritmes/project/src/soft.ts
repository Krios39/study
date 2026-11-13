import type { Solution } from "./model.ts";
import type { Problem } from "./problem.ts";

export interface SoftStats {
  sameSubjectInDay: number;
  dayImbalance: number;
}

export function softStats(problem: Problem, slotOf: Solution): SoftStats {
  const { nClasses, nSubjects, days, nLessons } = problem;
  const subjectInDay = new Int32Array(nClasses * days * nSubjects);
  const dayLoad = new Int32Array(nClasses * days);
  for (let l = 0; l < nLessons; l++) {
    if (slotOf[l] < 0) continue;
    const classDay = problem.lessonClass[l] * days + problem.dayOf(slotOf[l]);
    subjectInDay[classDay * nSubjects + problem.lessonSubject[l]]++;
    dayLoad[classDay]++;
  }

  let sameSubjectInDay = 0;
  for (const count of subjectInDay) if (count > 1) sameSubjectInDay += count - 1;

  let dayImbalance = 0;
  for (let c = 0; c < nClasses; c++) {
    const loads = dayLoad.subarray(c * days, (c + 1) * days);
    dayImbalance += Math.max(...loads) - Math.min(...loads);
  }
  return { sameSubjectInDay, dayImbalance };
}
