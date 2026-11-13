import type {
  Curriculum,
  Instance,
  LanguageOfInstruction,
  Requirement,
  SchoolClass,
  SubjectDictionary,
  Teacher,
} from "./model.ts";
import { SubjectCatalog } from "./subject-catalog.ts";

export interface GeneratorParams {
  name: string;
  seed: number;
  classes: number;
  shifts: 1 | 2;
  largeClassShare: number;
  teacherMaxLoad: number;
  unavailableShare: number;
  language?: LanguageOfInstruction;
}

export interface Generated {
  instance: Instance;
  hidden: number[];
}

interface DraftTeacher {
  id: string;
  group: string;
  load: number;
  busy: Set<number>;
}

const DAYS = 5;
const LAYOUT_ATTEMPTS = 200;
const GRADES = [5, 6, 7, 8, 9, 10, 11];
const SECOND_SHIFT_GRADES = new Set([6, 7, 8]);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

export class Generator {
  static generate(params: GeneratorParams, subjects: SubjectDictionary, curriculum: Curriculum): Generated {
    const random = Generator.rng(params.seed);
    const catalog = new SubjectCatalog(subjects, params.language ?? curriculum.languageOfInstruction);
    const groupOf = new Map<string, string>();
    for (const [group, ids] of Object.entries(TEACHER_GROUPS)) for (const id of ids) groupOf.set(id, group);

    const maxPerDayOf = (grade: number) => (grade <= 7 ? 7 : 8);
    const periodsPerShift = 8;
    const periodsPerDay = periodsPerShift * params.shifts;

    const classes: SchoolClass[] = [];
    const perGrade = new Map<number, number>();
    for (let i = 0; i < params.classes; i++) {
      const grade = GRADES[i % GRADES.length];
      const index = perGrade.get(grade) ?? 0;
      perGrade.set(grade, index + 1);
      const secondShift = params.shifts === 2 && SECOND_SHIFT_GRADES.has(grade);
      classes.push({
        id: `${grade}${LETTERS[index]}`,
        grade,
        firstPeriod: secondShift ? periodsPerShift : 0,
        maxPerDay: maxPerDayOf(grade),
      });
    }
    classes.sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id));

    const teachers: DraftTeacher[] = [];
    const requirements: Requirement[] = [];
    const hidden: number[] = [];
    const usedSubjects = new Set<string>();

    for (const cls of classes) {
      const hours = curriculum.hours[String(cls.grade)];
      const large = random() < params.largeClassShare;
      const split = new Map<string, boolean>();
      for (const subject of Object.keys(hours)) {
        if (!groupOf.has(subject)) throw new Error(`no teacher group for subject "${subject}"`);
        const rule = catalog.split(subject);
        split.set(subject, large && (rule === "required" || (rule === "allowed" && random() < 0.5)));
        usedSubjects.add(subject);
      }

      const staff = (layout: Map<string, number[]>) => {
        const before = teachers.length;
        const picks: { teacher: DraftTeacher; slots: number[] }[] = [];
        const rows: Requirement[] = [];
        for (const [subject, slots] of layout) {
          const chosen: DraftTeacher[] = [];
          for (let k = 0; k < (split.get(subject) ? 2 : 1); k++) {
            const teacher = Generator.pickTeacher(teachers, groupOf.get(subject)!, slots, params.teacherMaxLoad, chosen);
            teacher.load += slots.length;
            for (const s of slots) teacher.busy.add(s);
            chosen.push(teacher);
            picks.push({ teacher, slots });
          }
          rows.push({ class: cls.id, subject, teachers: chosen.map((t) => t.id), hours: slots.length });
        }
        const undo = () => {
          for (const { teacher, slots } of picks) {
            teacher.load -= slots.length;
            for (const s of slots) teacher.busy.delete(s);
          }
          teachers.length = before;
        };
        return { created: teachers.length - before, rows, undo };
      };

      let best: Map<string, number[]> | undefined;
      let bestCreated = Infinity;
      for (let attempt = 0; attempt < LAYOUT_ATTEMPTS && bestCreated > 0; attempt++) {
        const layout = Generator.layOutClass(cls, hours, periodsPerDay, random);
        const trial = staff(layout);
        if (trial.created < bestCreated) {
          bestCreated = trial.created;
          best = layout;
        }
        trial.undo();
      }
      requirements.push(...staff(best!).rows);
      for (const slots of best!.values()) hidden.push(...slots);
    }

    const instance: Instance = {
      name: params.name,
      days: DAYS,
      periodsPerDay,
      subjects: catalog.subjects(subjects.subjects.filter((s) => usedSubjects.has(s.id)).map((s) => s.id)),
      teachers: teachers.map((t) => Generator.finishTeacher(t, periodsPerDay, params.unavailableShare, random)),
      classes,
      requirements,
    };
    return { instance, hidden };
  }

  private static layOutClass(
    cls: SchoolClass,
    hours: Record<string, number>,
    periodsPerDay: number,
    random: () => number,
  ): Map<string, number[]> {
    const total = Object.values(hours).reduce((a, b) => a + b, 0);
    const capacity = Array.from({ length: DAYS }, (_, d) => Math.floor(total / DAYS) + (d < total % DAYS ? 1 : 0));
    Generator.shuffle(capacity, random);

    const days: string[][] = Array.from({ length: DAYS }, () => []);
    const subjects = Object.keys(hours).sort((a, b) => hours[b] - hours[a] || a.localeCompare(b));
    for (const subject of subjects) {
      for (let h = 0; h < hours[subject]; h++) {
        let best = -1;
        let bestScore = Infinity;
        const offset = Math.floor(random() * DAYS);
        for (let k = 0; k < DAYS; k++) {
          const d = (offset + k) % DAYS;
          if (days[d].length >= capacity[d]) continue;
          const repeats = days[d].filter((s) => s === subject).length;
          const score = repeats * 100 + days[d].length;
          if (score < bestScore) {
            bestScore = score;
            best = d;
          }
        }
        days[best].push(subject);
      }
    }

    const slots = new Map<string, number[]>(Object.keys(hours).map((s) => [s, []]));
    days.forEach((day, d) => {
      Generator.shuffle(day, random);
      day.forEach((subject, p) => slots.get(subject)!.push(d * periodsPerDay + cls.firstPeriod + p));
    });
    return slots;
  }

  private static pickTeacher(
    teachers: DraftTeacher[],
    group: string,
    slots: number[],
    maxLoad: number,
    exclude: DraftTeacher[],
  ): DraftTeacher {
    let best: DraftTeacher | undefined;
    for (const t of teachers) {
      if (t.group !== group || exclude.includes(t)) continue;
      if (t.load + slots.length > maxLoad || slots.some((s) => t.busy.has(s))) continue;
      if (!best || t.load > best.load) best = t;
    }
    if (best) return best;
    const created: DraftTeacher = {
      id: `${group}${teachers.filter((t) => t.group === group).length + 1}`,
      group,
      load: 0,
      busy: new Set(),
    };
    teachers.push(created);
    return created;
  }

  private static finishTeacher(t: DraftTeacher, periodsPerDay: number, share: number, random: () => number): Teacher {
    if (random() >= share) return { id: t.id };
    const freeDays: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      let free = true;
      for (let p = 0; p < periodsPerDay && free; p++) free = !t.busy.has(d * periodsPerDay + p);
      if (free) freeDays.push(d);
    }
    if (freeDays.length === 0) return { id: t.id };
    Generator.shuffle(freeDays, random);
    const daysOff = freeDays.slice(0, 1 + Math.floor(random() * Math.min(2, freeDays.length))).sort((a, b) => a - b);
    const unavailable: [number, number][] = [];
    for (const d of daysOff) for (let p = 0; p < periodsPerDay; p++) unavailable.push([d, p]);
    return { id: t.id, unavailable };
  }

  private static shuffle<T>(items: T[], random: () => number) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  private static rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}
