import type { Instance } from "./model.ts";

export interface Compiled {
  instance: Instance;
  days: number;
  periods: number;
  nSlots: number;
  nClasses: number;
  nTeachers: number;
  nSubjects: number;
  nLessons: number;

  lessonReq: Int32Array;
  lessonClass: Int32Array;
  lessonSubject: Int32Array;
  teacherStart: Int32Array;
  teacherList: Int32Array;

  classAllowed: Uint8Array;
  teacherAllowed: Uint8Array;
  lessonAllowed: Uint8Array;

  adjStart: Int32Array;
  adjList: Int32Array;
}

export function compile(inst: Instance): Compiled {
  const days = inst.days;
  const periods = inst.periodsPerDay;
  const nSlots = days * periods;
  const nClasses = inst.classes.length;
  const nTeachers = inst.teachers.length;
  const nSubjects = inst.subjects.length;

  const classIndex = new Map(inst.classes.map((c, i) => [c.id, i]));
  const teacherIndex = new Map(inst.teachers.map((t, i) => [t.id, i]));
  const subjectIndex = new Map(inst.subjects.map((s, i) => [s.id, i]));

  let nLessons = 0;
  let nTeacherRefs = 0;
  for (const r of inst.requirements) {
    nLessons += r.hours;
    nTeacherRefs += r.hours * r.teachers.length;
  }

  const lessonReq = new Int32Array(nLessons);
  const lessonClass = new Int32Array(nLessons);
  const lessonSubject = new Int32Array(nLessons);
  const teacherStart = new Int32Array(nLessons + 1);
  const teacherList = new Int32Array(nTeacherRefs);

  let lesson = 0;
  let ref = 0;
  inst.requirements.forEach((r, ri) => {
    const c = classIndex.get(r.class)!;
    const s = subjectIndex.get(r.subject)!;
    const ts = r.teachers.map((t) => teacherIndex.get(t)!);
    for (let h = 0; h < r.hours; h++) {
      lessonReq[lesson] = ri;
      lessonClass[lesson] = c;
      lessonSubject[lesson] = s;
      teacherStart[lesson] = ref;
      for (const t of ts) teacherList[ref++] = t;
      lesson++;
    }
  });
  teacherStart[nLessons] = ref;

  const classAllowed = new Uint8Array(nClasses * nSlots);
  inst.classes.forEach((c, ci) => {
    for (let d = 0; d < days; d++)
      for (let p = c.firstPeriod; p < c.firstPeriod + c.maxPerDay; p++) classAllowed[ci * nSlots + d * periods + p] = 1;
  });

  const teacherAllowed = new Uint8Array(nTeachers * nSlots).fill(1);
  inst.teachers.forEach((t, ti) => {
    for (const [d, p] of t.unavailable ?? []) teacherAllowed[ti * nSlots + d * periods + p] = 0;
  });

  const lessonAllowed = new Uint8Array(nLessons * nSlots);
  for (let l = 0; l < nLessons; l++) {
    const c = lessonClass[l];
    for (let s = 0; s < nSlots; s++) {
      let ok = classAllowed[c * nSlots + s];
      for (let k = teacherStart[l]; ok && k < teacherStart[l + 1]; k++) ok = teacherAllowed[teacherList[k] * nSlots + s];
      lessonAllowed[l * nSlots + s] = ok;
    }
  }

  const byClass: number[][] = Array.from({ length: nClasses }, () => []);
  const byTeacher: number[][] = Array.from({ length: nTeachers }, () => []);
  for (let l = 0; l < nLessons; l++) {
    byClass[lessonClass[l]].push(l);
    for (let k = teacherStart[l]; k < teacherStart[l + 1]; k++) byTeacher[teacherList[k]].push(l);
  }

  const adjStart = new Int32Array(nLessons + 1);
  const adj: number[] = [];
  const stamp = new Int32Array(nLessons).fill(-1);
  for (let l = 0; l < nLessons; l++) {
    adjStart[l] = adj.length;
    stamp[l] = l;
    const add = (group: number[]) => {
      for (const m of group) {
        if (stamp[m] !== l) {
          stamp[m] = l;
          adj.push(m);
        }
      }
    };
    add(byClass[lessonClass[l]]);
    for (let k = teacherStart[l]; k < teacherStart[l + 1]; k++) add(byTeacher[teacherList[k]]);
  }
  adjStart[nLessons] = adj.length;

  return {
    instance: inst,
    days,
    periods,
    nSlots,
    nClasses,
    nTeachers,
    nSubjects,
    nLessons,
    lessonReq,
    lessonClass,
    lessonSubject,
    teacherStart,
    teacherList,
    classAllowed,
    teacherAllowed,
    lessonAllowed,
    adjStart,
    adjList: Int32Array.from(adj),
  };
}
