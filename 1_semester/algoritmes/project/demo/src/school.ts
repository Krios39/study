import { DAYS, GRADES, PERIODS_PER_SHIFT, TEACHER_GROUPS } from "../../src/generators/instance-generator.ts";
import { SECOND_SHIFT_GRADES } from "../../src/generators/planted-generator.ts";
import { SubjectCatalog } from "../../src/io/subject-catalog.ts";
import type { Curriculum, Instance, Requirement, SchoolClass, SubjectDictionary, Teacher } from "../../src/model.ts";

export interface TeacherRow {
  id: string;
  group: string;
  load: number;
  free: number;
  shifts: number[];
}

interface Link {
  key: string;
  pool: string[];
  need: number;
  weights: number[];
  chosen: string[];
}

export interface GroupRow {
  group: string;
  hours: number;
  suggested: number;
}

export interface Issue {
  key: string;
  params: Record<string, string | number>;
  subject?: string;
}

export interface Verdict {
  impossible: Issue[];
  tight: Issue[];
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COMFORTABLE_LOAD = 24;
const TIGHT_SHARE = 0.85;

export class SchoolDraft {
  static readonly grades = GRADES;
  static readonly days = DAYS;
  static readonly secondShift = [...SECOND_SHIFT_GRADES];
  static readonly partsPerShift = 3;
  static readonly parts: [first: number, last: number][] = [0, PERIODS_PER_SHIFT].flatMap((base): [number, number][] => [
    [base, base + 2],
    [base + 3, base + 5],
    [base + 6, base + PERIODS_PER_SHIFT - 1],
  ]);
  readonly splitSubjects: string[];
  private readonly catalog: SubjectCatalog;
  private readonly curriculum: Curriculum;
  private readonly groupOf = new Map<string, string>();

  constructor(subjects: SubjectDictionary, curriculum: Curriculum) {
    this.catalog = new SubjectCatalog(subjects, curriculum.languageOfInstruction);
    this.curriculum = curriculum;
    this.splitSubjects = this.catalog.idsWithSplit("required");
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

  static doubled(classes: Map<number, number>, late: Set<number>): boolean {
    const second = [...classes.keys()].filter((grade) => late.has(grade)).length;
    return second > 0 && second < classes.size;
  }

  static linkKey(cls: string, group: string): string {
    return `${cls}:${group}`;
  }

  group(subject: string): string {
    return this.groupOf.get(subject)!;
  }

  instance(
    classes: Map<number, number>,
    teachers: Map<string, number>,
    closed: Map<string, number[]>,
    split: boolean,
    late = new Set<number>(),
    pinned = new Map<string, string[]>(),
  ): Instance {
    const doubled = SchoolDraft.doubled(classes, late);
    const periodsPerDay = doubled ? 2 * PERIODS_PER_SHIFT : PERIODS_PER_SHIFT;
    const load = new Map<string, number>();
    const staff: Teacher[] = [];
    for (const [group, count] of teachers) {
      for (let index = 0; index < count; index++) {
        const id = SchoolDraft.teacherId(group, index);
        const thirds = closed.get(id) ?? [];
        const teacher: Teacher = { id };
        const away = thirds.flatMap((third) => {
          const [first, last] = SchoolDraft.parts[third % SchoolDraft.parts.length];
          if (first >= periodsPerDay) return [];
          return Array.from({ length: last - first + 1 }, (_, at): [number, number] => [Math.floor(third / SchoolDraft.parts.length), first + at]);
        });
        if (away.length > 0) teacher.unavailable = away;
        staff.push(teacher);
        load.set(id, 0);
      }
    }
    const wanted = (subject: string) => (split && this.catalog.split(subject) === "required" ? 2 : 1);
    const rooms: SchoolClass[] = [];
    const links: Link[] = [];
    for (const [grade, count] of [...classes].sort((a, b) => a[0] - b[0])) {
      for (let index = 0; index < count; index++) {
        const cls: SchoolClass = { id: `${grade}${LETTERS[index]}`, grade, firstPeriod: doubled && late.has(grade) ? PERIODS_PER_SHIFT : 0, maxPerDay: grade <= 7 ? 7 : 8 };
        rooms.push(cls);
        const byGroup = new Map<string, number[]>();
        for (const [subject, hours] of Object.entries(this.curriculum.hours[String(grade)])) {
          const weights = byGroup.get(this.group(subject)) ?? [0, 0];
          for (let place = 0; place < wanted(subject); place++) weights[place] += hours;
          byGroup.set(this.group(subject), weights);
        }
        for (const [group, weights] of byGroup) {
          const pool = Array.from({ length: teachers.get(group) ?? 0 }, (_, at) => SchoolDraft.teacherId(group, at));
          const need = Math.min(pool.length, weights[1] > 0 ? 2 : 1);
          const asked = pinned.get(SchoolDraft.linkKey(cls.id, group)) ?? [];
          const chosen = asked.filter((id, at) => pool.includes(id) && asked.indexOf(id) === at).slice(0, need);
          links.push({ key: SchoolDraft.linkKey(cls.id, group), pool, need, weights, chosen });
        }
      }
    }
    for (const link of links) link.chosen.forEach((id, place) => load.set(id, load.get(id)! + link.weights[place]));
    for (const link of links) {
      while (link.chosen.length < link.need) {
        const next = link.pool.filter((id) => !link.chosen.includes(id)).sort((a, b) => load.get(a)! - load.get(b)!)[0];
        load.set(next, load.get(next)! + link.weights[link.chosen.length]);
        link.chosen.push(next);
      }
    }
    const chosenOf = new Map(links.map((link) => [link.key, link.chosen]));
    const requirements: Requirement[] = [];
    const used = new Set<string>();
    for (const cls of rooms) {
      for (const [subject, hours] of Object.entries(this.curriculum.hours[String(cls.grade)])) {
        const chosen = chosenOf.get(SchoolDraft.linkKey(cls.id, this.group(subject)))!;
        requirements.push({ class: cls.id, subject, teachers: chosen.slice(0, wanted(subject)), hours });
        used.add(subject);
      }
    }
    return {
      name: "your school",
      days: DAYS,
      periodsPerDay,
      subjects: this.catalog.subjects().filter((subject) => used.has(subject.id)),
      teachers: staff,
      classes: rooms,
      requirements,
    };
  }

  links(instance: Instance): Map<string, string[]> {
    const links = new Map<string, string[]>();
    for (const requirement of instance.requirements) {
      const key = SchoolDraft.linkKey(requirement.class, this.group(requirement.subject));
      if (requirement.teachers.length > (links.get(key)?.length ?? -1)) links.set(key, requirement.teachers);
    }
    return links;
  }

  static rows(instance: Instance): TeacherRow[] {
    const open = new Map<string, Set<number>>();
    const load = new Map<string, number>();
    const classes = new Map(instance.classes.map((cls) => [cls.id, cls]));
    for (const requirement of instance.requirements) {
      for (const id of requirement.teachers) {
        load.set(id, (load.get(id) ?? 0) + requirement.hours);
        const cls = classes.get(requirement.class)!;
        const periods = open.get(id) ?? new Set<number>();
        for (let at = 0; at < cls.maxPerDay; at++) periods.add(cls.firstPeriod + at);
        open.set(id, periods);
      }
    }
    return instance.teachers.map((teacher) => {
      const periods = open.get(teacher.id) ?? new Set<number>();
      const shifts = [...new Set([...periods].map((period) => Math.floor(period / PERIODS_PER_SHIFT)))].sort();
      const blocked = (teacher.unavailable ?? []).filter(([, period]) => periods.has(period)).length;
      return { id: teacher.id, group: teacher.id.replace(/\d+$/, ""), load: load.get(teacher.id) ?? 0, free: instance.days * periods.size - blocked, shifts };
    });
  }

  static verdict(instance: Instance): Verdict {
    const verdict: Verdict = { impossible: [], tight: [] };
    for (const requirement of instance.requirements) {
      if (requirement.teachers.length === 0) verdict.impossible.push({ key: "verdict.nobody", params: { class: requirement.class }, subject: requirement.subject });
    }
    for (const row of SchoolDraft.rows(instance)) {
      if (row.load > row.free) {
        verdict.impossible.push({ key: "verdict.overloaded", params: { teacher: row.id, load: row.load, free: row.free } });
      } else if (row.load > row.free * TIGHT_SHARE) {
        verdict.tight.push({ key: "verdict.nearlyFull", params: { teacher: row.id, load: row.load, free: row.free } });
      }
    }
    return verdict;
  }
}
