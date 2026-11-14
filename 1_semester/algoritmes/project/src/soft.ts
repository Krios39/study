import type { Solution } from "./model.ts";
import type { Problem } from "./problem.ts";

export interface SoftStats {
  sameSubjectInDay: number;
  dayImbalance: number;
  teacherGaps: number;
  worstTeacherGaps: number;
  shiftBreaks: number;
  shiftIdle: number;
  difficultySpread: number;
  misplaced: number;
  wishesBroken: number;
}

export const HEAVY_FROM = 9;
export const EASY_UP_TO = 6;

export function softStats(problem: Problem, slotOf: Solution): SoftStats {
  const { nClasses, nTeachers, nSubjects, nSlots, days, periods, nLessons } = problem;
  const subjectInDay = new Int32Array(nClasses * days * nSubjects);
  const dayLoad = new Int32Array(nClasses * days);
  const dayScore = new Int32Array(nClasses * days);
  const classScore = new Int32Array(nClasses);
  const teacherBusy = new Uint8Array(nTeachers * nSlots);
  const classBusy = new Uint8Array(nClasses * nSlots);
  const heavyAt = new Uint8Array(nClasses * nSlots);
  const easyAt = new Uint8Array(nClasses * nSlots);
  for (let l = 0; l < nLessons; l++) {
    const score = problem.instance.subjects[problem.lessonSubject[l]].difficulty;
    classScore[problem.lessonClass[l]] += score;
    if (slotOf[l] < 0) continue;
    const classDay = problem.lessonClass[l] * days + problem.dayOf(slotOf[l]);
    subjectInDay[classDay * nSubjects + problem.lessonSubject[l]]++;
    dayLoad[classDay]++;
    dayScore[classDay] += score;
    const cell = problem.lessonClass[l] * nSlots + slotOf[l];
    classBusy[cell] = 1;
    if (score >= HEAVY_FROM) heavyAt[cell] = 1;
    if (score <= EASY_UP_TO) easyAt[cell] = 1;
    for (const t of problem.teachersOf(l)) teacherBusy[t * nSlots + slotOf[l]] = 1;
  }

  let wishesBroken = 0;
  for (let l = 0; l < nLessons; l++) {
    if (slotOf[l] < 0) continue;
    for (const t of problem.teachersOf(l)) wishesBroken += problem.teacherWished[t * periods + problem.periodOf(slotOf[l])];
  }

  let sameSubjectInDay = 0;
  for (const count of subjectInDay) if (count > 1) sameSubjectInDay += count - 1;

  let dayImbalance = 0;
  let difficultySpread = 0;
  for (let c = 0; c < nClasses; c++) {
    const loads = dayLoad.subarray(c * days, (c + 1) * days);
    dayImbalance += Math.max(...loads) - Math.min(...loads);
    for (let d = 0; d < days; d++) difficultySpread += Math.abs(days * dayScore[c * days + d] - classScore[c]);
  }

  let teacherGaps = 0;
  let worstTeacherGaps = 0;
  let shiftBreaks = 0;
  let shiftIdle = 0;
  for (let t = 0; t < nTeachers; t++) {
    let week = 0;
    for (let d = 0; d < days; d++) {
      let shift = -1;
      let shifts = 0;
      let first = -1;
      let last = -1;
      let busy = 0;
      for (let p = 0; p < periods; p++) {
        if (!teacherBusy[t * nSlots + d * periods + p]) continue;
        if (problem.periodShift[p] !== shift) {
          if (shift >= 0) {
            week += last - first + 1 - busy;
            shiftIdle += p - last - 1;
          }
          shift = problem.periodShift[p];
          shifts++;
          first = p;
          busy = 0;
        }
        last = p;
        busy++;
      }
      if (shift >= 0) week += last - first + 1 - busy;
      if (shifts > 1) shiftBreaks += shifts - 1;
    }
    teacherGaps += week;
    worstTeacherGaps = Math.max(worstTeacherGaps, week);
  }

  let misplaced = 0;
  for (let c = 0; c < nClasses; c++) {
    for (let d = 0; d < days; d++) {
      const base = c * nSlots + d * periods;
      let load = 0;
      for (let p = 0; p < periods; p++) load += classBusy[base + p];
      let index = 0;
      for (let p = 0; p < periods; p++) {
        if (!classBusy[base + p]) continue;
        if (index < Math.floor(load / 2) && easyAt[base + p]) misplaced++;
        if (index >= Math.ceil(load / 2) && heavyAt[base + p]) misplaced++;
        index++;
      }
    }
  }

  return {
    sameSubjectInDay,
    dayImbalance,
    teacherGaps,
    worstTeacherGaps,
    shiftBreaks,
    shiftIdle,
    difficultySpread: difficultySpread / days,
    misplaced,
    wishesBroken,
  };
}
