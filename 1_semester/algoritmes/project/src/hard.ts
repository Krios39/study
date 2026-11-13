import type { Problem } from "./problem.ts";
import type { Solution } from "./model.ts";

export interface HardViolations {
  classClash: number;
  teacherClash: number;
  unassigned: number;
  classSlot: number;
  classGap: number;
  teacherUnavailable: number;
  total: number;
}

export function hardViolations(c: Problem, slotOf: Solution): HardViolations {
  const { nSlots, nClasses, nTeachers, nLessons, days, periods } = c;
  const classLoad = new Int32Array(nClasses * nSlots);
  const teacherLoad = new Int32Array(nTeachers * nSlots);
  const v: HardViolations = {
    classClash: 0,
    teacherClash: 0,
    unassigned: 0,
    classSlot: 0,
    classGap: 0,
    teacherUnavailable: 0,
    total: 0,
  };

  for (let l = 0; l < nLessons; l++) {
    const s = slotOf[l];
    if (s < 0) {
      v.unassigned++;
      continue;
    }
    const cls = c.lessonClass[l];
    classLoad[cls * nSlots + s]++;
    if (!c.classAllowed[cls * nSlots + s]) v.classSlot++;
    for (let k = c.teacherStart[l]; k < c.teacherStart[l + 1]; k++) {
      const t = c.teacherList[k];
      teacherLoad[t * nSlots + s]++;
      if (!c.teacherAllowed[t * nSlots + s]) v.teacherUnavailable++;
    }
  }

  for (let i = 0; i < classLoad.length; i++) if (classLoad[i] > 1) v.classClash += classLoad[i] - 1;
  for (let i = 0; i < teacherLoad.length; i++) if (teacherLoad[i] > 1) v.teacherClash += teacherLoad[i] - 1;

  c.instance.classes.forEach((cls, ci) => {
    for (let d = 0; d < days; d++) {
      const base = ci * nSlots + d * periods;
      let last = -1;
      let busy = 0;
      for (let p = cls.firstPeriod; p < cls.firstPeriod + cls.maxPerDay; p++) {
        if (classLoad[base + p] > 0) {
          last = p;
          busy++;
        }
      }
      if (last >= 0) v.classGap += last - cls.firstPeriod + 1 - busy;
    }
  });

  v.total = v.classClash + v.teacherClash + v.unassigned + v.classSlot + v.classGap + v.teacherUnavailable;
  return v;
}
