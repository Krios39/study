import { DAYS, GRADES, PERIODS_PER_SHIFT, TEACHER_GROUPS } from "../../src/generators/instance-generator.ts";
import { SubjectCatalog } from "../../src/io/subject-catalog.ts";
import type { Curriculum, Instance, Requirement, SchoolClass, SubjectDictionary, Teacher } from "../../src/model.ts";

export interface TeacherRow {
  id: string;
  group: string;
  load: number;
  free: number;
}

export interface GroupRow {
  group: string;
  hours: number;
  suggested: number;
}

export interface Verdict {
  impossible: string[];
  tight: string[];
}

export const GROUP_LABELS: Record<string, string> = {
  math: "Math",
  rus: "Russian",
  kaz: "Kazakh",
  eng: "English",
  inf: "Informatics",
  phys: "Physics",
  chem: "Chemistry, biology",
  geo: "Geography",
  hist: "History, law",
  music: "Music",
  art: "Art and labour",
  pe: "Physical education",
  mil: "Military training",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COMFORTABLE_LOAD = 24;
const TIGHT_SHARE = 0.85;

export class SchoolDraft {
  static readonly grades = GRADES;
  static readonly days = DAYS;
  static readonly parts: [first: number, last: number][] = [[0, 2], [3, 5], [6, PERIODS_PER_SHIFT - 1]];
  readonly splitSubjects: string[];
  private readonly catalog: SubjectCatalog;
  private readonly curriculum: Curriculum;
  private readonly groupOf = new Map<string, string>();

  constructor(subjects: SubjectDictionary, curriculum: Curriculum) {
    this.catalog = new SubjectCatalog(subjects, curriculum.languageOfInstruction);
    this.curriculum = curriculum;
    this.splitSubjects = this.catalog.idsWithSplit("required").map((id) => id.charAt(0).toUpperCase() + id.slice(1).replace("_language", "").replaceAll("_", " "));
    for (const [group, ids] of Object.entries(TEACHER_GROUPS)) for (const id of ids) this.groupOf.set(id, group);
  }

  difficulty(subject: string): number {
    return this.catalog.difficulty(subject);
  }

  static teacherId(group: string, index: number): string {
    return `${group}${index + 1}`;
  }

  groups(classes: Map<number, number>, split: boolean): GroupRow[] {
    const hours = new Map<string, number>();
    for (const [grade, count] of classes) {
      for (const [subject, weekly] of Object.entries(this.curriculum.hours[String(grade)])) {
        const group = this.groupOf.get(subject)!;
        hours.set(group, (hours.get(group) ?? 0) + weekly * count * (split && this.catalog.split(subject) === "required" ? 2 : 1));
      }
    }
    return Object.keys(TEACHER_GROUPS)
      .filter((group) => hours.has(group))
      .map((group) => ({ group, hours: hours.get(group)!, suggested: Math.max(1, Math.ceil(hours.get(group)! / COMFORTABLE_LOAD)) }));
  }

  instance(classes: Map<number, number>, teachers: Map<string, number>, closed: Map<string, number[]>, split: boolean): Instance {
    const load = new Map<string, number>();
    const staff: Teacher[] = [];
    for (const [group, count] of teachers) {
      for (let index = 0; index < count; index++) {
        const id = SchoolDraft.teacherId(group, index);
        const thirds = closed.get(id) ?? [];
        const teacher: Teacher = { id };
        if (thirds.length > 0) {
          teacher.unavailable = thirds.flatMap((third) => {
            const [first, last] = SchoolDraft.parts[third % SchoolDraft.parts.length];
            return Array.from({ length: last - first + 1 }, (_, at): [number, number] => [Math.floor(third / SchoolDraft.parts.length), first + at]);
          });
        }
        staff.push(teacher);
        load.set(id, 0);
      }
    }
    const rooms: SchoolClass[] = [];
    const requirements: Requirement[] = [];
    const used = new Set<string>();
    for (const [grade, count] of [...classes].sort((a, b) => a[0] - b[0])) {
      for (let index = 0; index < count; index++) {
        const cls: SchoolClass = { id: `${grade}${LETTERS[index]}`, grade, firstPeriod: 0, maxPerDay: grade <= 7 ? 7 : 8 };
        rooms.push(cls);
        for (const [subject, hours] of Object.entries(this.curriculum.hours[String(grade)])) {
          const group = this.groupOf.get(subject)!;
          const pool = Array.from({ length: teachers.get(group) ?? 0 }, (_, at) => SchoolDraft.teacherId(group, at));
          const wanted = split && this.catalog.split(subject) === "required" ? 2 : 1;
          const chosen = pool.sort((a, b) => load.get(a)! - load.get(b)!).slice(0, wanted);
          for (const id of chosen) load.set(id, load.get(id)! + hours);
          requirements.push({ class: cls.id, subject, teachers: chosen, hours });
          used.add(subject);
        }
      }
    }
    return {
      name: "your school",
      days: DAYS,
      periodsPerDay: PERIODS_PER_SHIFT,
      subjects: this.catalog.subjects().filter((subject) => used.has(subject.id)),
      teachers: staff,
      classes: rooms,
      requirements,
    };
  }

  static rows(instance: Instance): TeacherRow[] {
    const longest = new Map<string, number>();
    const load = new Map<string, number>();
    const days = new Map(instance.classes.map((cls) => [cls.id, cls.maxPerDay]));
    for (const requirement of instance.requirements) {
      for (const id of requirement.teachers) {
        load.set(id, (load.get(id) ?? 0) + requirement.hours);
        longest.set(id, Math.max(longest.get(id) ?? 0, days.get(requirement.class)!));
      }
    }
    return instance.teachers.map((teacher) => {
      const periods = longest.get(teacher.id) ?? 0;
      const blocked = (teacher.unavailable ?? []).filter(([, period]) => period < periods).length;
      return { id: teacher.id, group: teacher.id.replace(/\d+$/, ""), load: load.get(teacher.id) ?? 0, free: instance.days * periods - blocked };
    });
  }

  static verdict(instance: Instance): Verdict {
    const verdict: Verdict = { impossible: [], tight: [] };
    for (const requirement of instance.requirements) {
      if (requirement.teachers.length === 0) verdict.impossible.push(`Nobody teaches ${requirement.subject.replaceAll("_", " ")} in class ${requirement.class}.`);
    }
    for (const row of SchoolDraft.rows(instance)) {
      if (row.load > row.free) {
        verdict.impossible.push(`Teacher ${row.id} has ${row.load} lessons a week but only ${row.free} lesson times when they can teach.`);
      } else if (row.load > row.free * TIGHT_SHARE) {
        verdict.tight.push(`Teacher ${row.id} is nearly full: ${row.load} lessons in ${row.free} possible times.`);
      }
    }
    return verdict;
  }
}
