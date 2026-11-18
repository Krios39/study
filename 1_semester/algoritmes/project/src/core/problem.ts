import type { Instance } from "../model.ts";

interface Lessons {
  nLessons: number;
  lessonReq: Int32Array;
  lessonClass: Int32Array;
  lessonSubject: Int32Array;
  teacherStart: Int32Array;
  teacherList: Int32Array;
}

interface ProblemData extends Lessons {
  instance: Instance;
  classAllowed: Uint8Array;
  teacherAllowed: Uint8Array;
  lessonAllowed: Uint8Array;
  adjStart: Int32Array;
  adjList: Int32Array;
}

export class Problem {
  readonly instance: Instance;
  readonly days: number;
  readonly periods: number;
  readonly nSlots: number;
  readonly nClasses: number;
  readonly nTeachers: number;
  readonly nSubjects: number;
  readonly nLessons: number;
  readonly periodShift: Int32Array;
  readonly teacherWished: Uint8Array;

  readonly lessonReq: Int32Array;
  readonly lessonClass: Int32Array;
  readonly lessonSubject: Int32Array;
  readonly teacherStart: Int32Array;
  readonly teacherList: Int32Array;

  readonly classAllowed: Uint8Array;
  readonly teacherAllowed: Uint8Array;
  readonly lessonAllowed: Uint8Array;

  readonly adjStart: Int32Array;
  readonly adjList: Int32Array;

  private constructor(data: ProblemData) {
    this.instance = data.instance;
    this.days = data.instance.days;
    this.periods = data.instance.periodsPerDay;
    this.nSlots = this.days * this.periods;
    this.nClasses = data.instance.classes.length;
    this.nTeachers = data.instance.teachers.length;
    this.nSubjects = data.instance.subjects.length;
    this.nLessons = data.nLessons;
    this.teacherWished = new Uint8Array(this.nTeachers * this.periods);
    data.instance.teachers.forEach((t, ti) => {
      if (!t.wish) return;
      for (let p = t.wish.periods[0]; p <= t.wish.periods[1]; p++) this.teacherWished[ti * this.periods + p] = 1;
    });
    const shiftStarts = [...new Set(data.instance.classes.map((c) => c.firstPeriod))];
    this.periodShift = Int32Array.from({ length: this.periods }, (_, p) => shiftStarts.filter((s) => s <= p).length);
    this.lessonReq = data.lessonReq;
    this.lessonClass = data.lessonClass;
    this.lessonSubject = data.lessonSubject;
    this.teacherStart = data.teacherStart;
    this.teacherList = data.teacherList;
    this.classAllowed = data.classAllowed;
    this.teacherAllowed = data.teacherAllowed;
    this.lessonAllowed = data.lessonAllowed;
    this.adjStart = data.adjStart;
    this.adjList = data.adjList;
  }

  static from(instance: Instance): Problem {
    const lessons = Problem.expandLessons(instance);
    const classAllowed = Problem.buildClassAllowed(instance);
    const teacherAllowed = Problem.buildTeacherAllowed(instance);
    const lessonAllowed = Problem.buildLessonAllowed(instance, lessons, classAllowed, teacherAllowed);
    const graph = Problem.buildConflictGraph(instance, lessons);
    return new Problem({
      instance,
      ...lessons,
      classAllowed,
      teacherAllowed,
      lessonAllowed,
      adjStart: graph.start,
      adjList: graph.list,
    });
  }

  slot(day: number, period: number): number {
    return day * this.periods + period;
  }

  dayOf(slot: number): number {
    return Math.floor(slot / this.periods);
  }

  periodOf(slot: number): number {
    return slot % this.periods;
  }

  neighbours(lesson: number): Int32Array {
    return this.adjList.subarray(this.adjStart[lesson], this.adjStart[lesson + 1]);
  }

  degree(lesson: number): number {
    return this.adjStart[lesson + 1] - this.adjStart[lesson];
  }

  teachersOf(lesson: number): Int32Array {
    return this.teacherList.subarray(this.teacherStart[lesson], this.teacherStart[lesson + 1]);
  }

  isAllowed(lesson: number, slot: number): boolean {
    return this.lessonAllowed[lesson * this.nSlots + slot] === 1;
  }

  private static expandLessons(inst: Instance): Lessons {
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
    return { nLessons, lessonReq, lessonClass, lessonSubject, teacherStart, teacherList };
  }

  private static buildClassAllowed(inst: Instance): Uint8Array {
    const nSlots = inst.days * inst.periodsPerDay;
    const allowed = new Uint8Array(inst.classes.length * nSlots);
    inst.classes.forEach((c, ci) => {
      for (let d = 0; d < inst.days; d++)
        for (let p = c.firstPeriod; p < c.firstPeriod + c.maxPerDay; p++)
          allowed[ci * nSlots + d * inst.periodsPerDay + p] = 1;
    });
    return allowed;
  }

  private static buildTeacherAllowed(inst: Instance): Uint8Array {
    const nSlots = inst.days * inst.periodsPerDay;
    const allowed = new Uint8Array(inst.teachers.length * nSlots).fill(1);
    inst.teachers.forEach((t, ti) => {
      for (const [d, p] of t.unavailable ?? []) allowed[ti * nSlots + d * inst.periodsPerDay + p] = 0;
    });
    return allowed;
  }

  private static buildLessonAllowed(
    inst: Instance,
    lessons: Lessons,
    classAllowed: Uint8Array,
    teacherAllowed: Uint8Array,
  ): Uint8Array {
    const { nLessons, lessonClass, teacherStart, teacherList } = lessons;
    const nSlots = inst.days * inst.periodsPerDay;
    const allowed = new Uint8Array(nLessons * nSlots);
    for (let l = 0; l < nLessons; l++) {
      const c = lessonClass[l];
      for (let s = 0; s < nSlots; s++) {
        let ok = classAllowed[c * nSlots + s];
        for (let k = teacherStart[l]; ok && k < teacherStart[l + 1]; k++) ok = teacherAllowed[teacherList[k] * nSlots + s];
        allowed[l * nSlots + s] = ok;
      }
    }
    return allowed;
  }

  private static buildConflictGraph(inst: Instance, lessons: Lessons): { start: Int32Array; list: Int32Array } {
    const { nLessons, lessonClass, teacherStart, teacherList } = lessons;
    const byClass: number[][] = Array.from({ length: inst.classes.length }, () => []);
    const byTeacher: number[][] = Array.from({ length: inst.teachers.length }, () => []);
    for (let l = 0; l < nLessons; l++) {
      byClass[lessonClass[l]].push(l);
      for (let k = teacherStart[l]; k < teacherStart[l + 1]; k++) byTeacher[teacherList[k]].push(l);
    }

    const start = new Int32Array(nLessons + 1);
    const list: number[] = [];
    const stamp = new Int32Array(nLessons).fill(-1);
    for (let l = 0; l < nLessons; l++) {
      start[l] = list.length;
      stamp[l] = l;
      const add = (group: number[]) => {
        for (const m of group) {
          if (stamp[m] !== l) {
            stamp[m] = l;
            list.push(m);
          }
        }
      };
      add(byClass[lessonClass[l]]);
      for (let k = teacherStart[l]; k < teacherStart[l + 1]; k++) add(byTeacher[teacherList[k]]);
    }
    start[nLessons] = list.length;
    return { start, list: Int32Array.from(list) };
  }
}
