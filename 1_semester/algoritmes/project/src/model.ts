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

export type SplitRule = "required" | "allowed";

export interface DictionarySubject {
  id: string;
  difficulty: number | Record<LanguageOfInstruction, number>;
  split?: SplitRule | Partial<Record<LanguageOfInstruction, SplitRule>>;
  inJustEdu: boolean;
  difficultyAssumed?: boolean;
}

export interface SubjectDictionary {
  source: string;
  subjects: DictionarySubject[];
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
