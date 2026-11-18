import type { Rng } from "../core/rng.ts";
import { SubjectCatalog } from "../io/subject-catalog.ts";
import type {
  Curriculum,
  Instance,
  LanguageOfInstruction,
  Requirement,
  SchoolClass,
  SubjectDictionary,
  Teacher,
} from "../model.ts";
import { Wishes } from "./wishes.ts";

export const DAYS = 5;
export const PERIODS_PER_SHIFT = 8;
export const GRADES = [5, 6, 7, 8, 9, 10, 11];
export const DEFAULT_WISH_SHARE = 0.3;

export const TEACHER_GROUPS: Record<string, string[]> = {
  math: ["math", "algebra", "geometry"],
  rus: ["russian_language", "russian_literature"],
  kaz: ["kazakh_language"],
  eng: ["english_language"],
  inf: ["informatics"],
  phys: ["physics"],
  chem: ["chemistry", "biology", "natural_science"],
  geo: ["geography"],
  hist: ["kazakh_history", "worldwide_history", "law_basics"],
  music: ["music"],
  art: ["art_labour"],
  pe: ["physical_education"],
  mil: ["military_training"],
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface GeneratorParams {
  seed: number;
  language?: LanguageOfInstruction;
  wishShare?: number;
}

export interface GeneratedInstance {
  instance: Instance;
}

export abstract class InstanceGenerator<P extends GeneratorParams, G extends GeneratedInstance> {
  protected readonly subjects: SubjectDictionary;
  protected readonly curriculum: Curriculum;
  private readonly groupOfSubject = new Map<string, string>();

  constructor(subjects: SubjectDictionary, curriculum: Curriculum) {
    this.subjects = subjects;
    this.curriculum = curriculum;
    for (const [group, ids] of Object.entries(TEACHER_GROUPS)) for (const id of ids) this.groupOfSubject.set(id, group);
  }

  abstract generate(params: P): G;

  protected catalog(params: P): SubjectCatalog {
    return new SubjectCatalog(this.subjects, params.language ?? this.curriculum.languageOfInstruction);
  }

  protected hoursOf(grade: number): Record<string, number> {
    return this.curriculum.hours[String(grade)];
  }

  protected groupOf(subject: string): string {
    const group = this.groupOfSubject.get(subject);
    if (!group) throw new Error(`no teacher group for subject "${subject}"`);
    return group;
  }

  protected classId(grade: number, index: number): string {
    const letters =
      index < LETTERS.length ? LETTERS[index] : LETTERS[Math.floor(index / LETTERS.length) - 1] + LETTERS[index % LETTERS.length];
    return `${grade}${letters}`;
  }

  protected normalDayLength(grade: number): number {
    return grade <= 7 ? 7 : 8;
  }

  protected isSplit(catalog: SubjectCatalog, subject: string, largeClass: boolean, rng: Rng): boolean {
    const rule = catalog.split(subject);
    return largeClass && (rule === "required" || (rule === "allowed" && rng.chance(0.5)));
  }

  protected assemble(
    name: string,
    periodsPerDay: number,
    catalog: SubjectCatalog,
    usedSubjects: Set<string>,
    teachers: Teacher[],
    classes: SchoolClass[],
    requirements: Requirement[],
  ): Instance {
    return {
      name,
      days: DAYS,
      periodsPerDay,
      subjects: catalog.subjects(this.subjects.subjects.filter((s) => usedSubjects.has(s.id)).map((s) => s.id)),
      teachers,
      classes,
      requirements,
    };
  }

  protected assignWishes(instance: Instance, rng: Rng, share: number | undefined) {
    const wishShare = share ?? DEFAULT_WISH_SHARE;
    for (const teacher of instance.teachers) {
      if (!rng.chance(wishShare)) continue;
      const wish = Wishes.draw(rng, instance, teacher);
      if (wish) teacher.wish = wish;
    }
  }
}
