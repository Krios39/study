import { readFileSync } from "node:fs";

export interface Subject {
  id: string;
  difficulty: number;
}

export interface Teacher {
  id: string;
  unavailable?: [day: number, period: number][];
}

export interface SchoolClass {
  id: string;
  grade: number;
  firstPeriod: number;
  maxPerDay: number;
}

export interface Requirement {
  class: string;
  subject: string;
  teachers: string[];
  hours: number;
}

export interface Instance {
  name: string;
  days: number;
  periodsPerDay: number;
  subjects: Subject[];
  teachers: Teacher[];
  classes: SchoolClass[];
  requirements: Requirement[];
}

export type LanguageOfInstruction = "ru" | "kk";

export const LANGUAGES_OF_INSTRUCTION: readonly LanguageOfInstruction[] = ["ru", "kk"];

export interface DictionarySubject {
  id: string;
  difficulty: number | Record<LanguageOfInstruction, number>;
  split?: boolean | Record<LanguageOfInstruction, boolean>;
  inJustEdu: boolean;
  difficultyAssumed?: boolean;
}

export function subjectSplits(subject: DictionarySubject, language: LanguageOfInstruction): boolean {
  if (subject.split === undefined) return false;
  return typeof subject.split === "boolean" ? subject.split : subject.split[language];
}

export interface SubjectDictionary {
  source: string;
  subjects: DictionarySubject[];
}

export function subjectDifficulty(subject: DictionarySubject, language: LanguageOfInstruction): number {
  return typeof subject.difficulty === "number" ? subject.difficulty : subject.difficulty[language];
}

export function subjectsFor(dict: SubjectDictionary, language: LanguageOfInstruction, ids?: Iterable<string>): Subject[] {
  const wanted = ids && new Set(ids);
  return dict.subjects
    .filter((s) => !wanted || wanted.has(s.id))
    .map((s) => ({ id: s.id, difficulty: subjectDifficulty(s, language) }));
}

export type HoursBySubject = Record<string, number>;

export interface Curriculum {
  source: string;
  languageOfInstruction: LanguageOfInstruction;
  weeklyMax: Record<string, number>;
  hours: Record<string, HoursBySubject>;
}

export type Solution = Int32Array;

export const UNASSIGNED = -1;

export function validateInstance(inst: Instance) {
  const errors: string[] = [];
  const unique = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${kind} id "${id}"`);
      seen.add(id);
    }
    return seen;
  };
  const subjects = unique("subject", inst.subjects.map((s) => s.id));
  const teachers = unique("teacher", inst.teachers.map((t) => t.id));
  const classes = unique("class", inst.classes.map((c) => c.id));

  if (!(inst.days > 0) || !(inst.periodsPerDay > 0)) errors.push("days and periodsPerDay must be positive");

  for (const c of inst.classes) {
    if (c.firstPeriod < 0 || c.maxPerDay <= 0 || c.firstPeriod + c.maxPerDay > inst.periodsPerDay)
      errors.push(`class "${c.id}": periods ${c.firstPeriod}..${c.firstPeriod + c.maxPerDay - 1} do not fit the day`);
  }
  for (const t of inst.teachers) {
    for (const [d, p] of t.unavailable ?? []) {
      if (d < 0 || d >= inst.days || p < 0 || p >= inst.periodsPerDay)
        errors.push(`teacher "${t.id}": unavailable slot [${d}, ${p}] is outside the grid`);
    }
  }
  const hoursByClass = new Map<string, number>();
  inst.requirements.forEach((r, i) => {
    const where = `requirement #${i} (${r.class}, ${r.subject})`;
    if (!classes.has(r.class)) errors.push(`${where}: unknown class`);
    if (!subjects.has(r.subject)) errors.push(`${where}: unknown subject`);
    if (r.teachers.length === 0) errors.push(`${where}: no teachers`);
    if (new Set(r.teachers).size !== r.teachers.length) errors.push(`${where}: repeated teacher`);
    for (const t of r.teachers) if (!teachers.has(t)) errors.push(`${where}: unknown teacher "${t}"`);
    if (!Number.isInteger(r.hours) || r.hours <= 0) errors.push(`${where}: hours must be a positive integer`);
    hoursByClass.set(r.class, (hoursByClass.get(r.class) ?? 0) + r.hours);
  });
  for (const c of inst.classes) {
    const hours = hoursByClass.get(c.id) ?? 0;
    if (hours > c.maxPerDay * inst.days)
      errors.push(`class "${c.id}": ${hours} lessons do not fit ${c.maxPerDay} per day x ${inst.days} days`);
  }

  if (errors.length > 0) throw new Error(`invalid instance "${inst.name}":\n  ${errors.join("\n  ")}`);
}

export function loadSubjectDictionary(path: string): SubjectDictionary {
  const dict = JSON.parse(readFileSync(path, "utf8")) as SubjectDictionary;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of dict.subjects) {
    if (seen.has(s.id)) errors.push(`duplicate subject id "${s.id}"`);
    seen.add(s.id);
    for (const lang of LANGUAGES_OF_INSTRUCTION)
      if (!(subjectDifficulty(s, lang) > 0)) errors.push(`subject "${s.id}": difficulty for "${lang}" must be positive`);
  }
  if (errors.length > 0) throw new Error(`invalid subject dictionary ${path}:\n  ${errors.join("\n  ")}`);
  return dict;
}

export function loadCurriculum(path: string, subjects?: SubjectDictionary): Curriculum {
  const cur = JSON.parse(readFileSync(path, "utf8")) as Curriculum;
  const errors: string[] = [];
  const known = subjects && new Set(subjects.subjects.map((s) => s.id));
  for (const [grade, hours] of Object.entries(cur.hours)) {
    let total = 0;
    for (const [subject, h] of Object.entries(hours)) {
      if (known && !known.has(subject)) errors.push(`grade ${grade}: unknown subject "${subject}"`);
      if (!Number.isInteger(h) || h <= 0) errors.push(`grade ${grade}, ${subject}: hours must be a positive integer`);
      total += h;
    }
    const max = cur.weeklyMax[grade];
    if (max === undefined) errors.push(`grade ${grade}: no weeklyMax`);
    else if (total > max) errors.push(`grade ${grade}: ${total} hours exceed weeklyMax ${max}`);
  }
  if (errors.length > 0) throw new Error(`invalid curriculum ${path}:\n  ${errors.join("\n  ")}`);
  return cur;
}

export function loadInstance(path: string): Instance {
  const inst = JSON.parse(readFileSync(path, "utf8")) as Instance;
  validateInstance(inst);
  return inst;
}
