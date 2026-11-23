import { Rng } from "../core/rng.ts";
import type { Requirement, SchoolClass, Teacher } from "../model.ts";
import {
  DAYS,
  GRADES,
  InstanceGenerator,
  PERIODS_PER_SHIFT,
  type GeneratedInstance,
  type GeneratorParams,
} from "./instance-generator.ts";

export interface PlantedParams extends GeneratorParams {
  name: string;
  classes: number;
  shifts: 1 | 2;
  largeClassShare: number;
  teacherMaxLoad: number;
  unavailableShare: number;
}

export interface Planted extends GeneratedInstance {
  hidden: number[];
}

interface DraftTeacher {
  id: string;
  group: string;
  load: number;
  busy: Set<number>;
}

const LAYOUT_ATTEMPTS = 200;
export const SECOND_SHIFT_GRADES = new Set([6, 7, 8]);

export class PlantedGenerator extends InstanceGenerator<PlantedParams, Planted> {
  generate(params: PlantedParams): Planted {
    const rng = new Rng(params.seed);
    const catalog = this.catalog(params);
    const periodsPerDay = PERIODS_PER_SHIFT * params.shifts;

    const classes: SchoolClass[] = [];
    const perGrade = new Map<number, number>();
    for (let i = 0; i < params.classes; i++) {
      const grade = GRADES[i % GRADES.length];
      const index = perGrade.get(grade) ?? 0;
      perGrade.set(grade, index + 1);
      const secondShift = params.shifts === 2 && SECOND_SHIFT_GRADES.has(grade);
      classes.push({
        id: this.classId(grade, index),
        grade,
        firstPeriod: secondShift ? PERIODS_PER_SHIFT : 0,
        maxPerDay: this.normalDayLength(grade),
      });
    }
    classes.sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id));

    const drafts: DraftTeacher[] = [];
    const requirements: Requirement[] = [];
    const hidden: number[] = [];
    const usedSubjects = new Set<string>();

    for (const cls of classes) {
      const hours = this.hoursOf(cls.grade);
      const large = rng.chance(params.largeClassShare);
      const split = new Map<string, boolean>();
      for (const subject of Object.keys(hours)) {
        this.groupOf(subject);
        split.set(subject, this.isSplit(catalog, subject, large, rng));
        usedSubjects.add(subject);
      }

      const staff = (layout: Map<string, number[]>) => {
        const before = drafts.length;
        const picks: { teacher: DraftTeacher; slots: number[] }[] = [];
        const rows: Requirement[] = [];
        for (const [subject, slots] of layout) {
          const chosen: DraftTeacher[] = [];
          for (let k = 0; k < (split.get(subject) ? 2 : 1); k++) {
            const teacher = this.pickTeacher(drafts, this.groupOf(subject), slots, params.teacherMaxLoad, chosen);
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
          drafts.length = before;
        };
        return { created: drafts.length - before, rows, undo };
      };

      let best: Map<string, number[]> | undefined;
      let bestCreated = Infinity;
      for (let attempt = 0; attempt < LAYOUT_ATTEMPTS && bestCreated > 0; attempt++) {
        const layout = this.layOutClass(cls, hours, periodsPerDay, rng);
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

    const teachers = drafts.map((t) => this.finishTeacher(t, periodsPerDay, params.unavailableShare, rng));
    const instance = this.assemble(params.name, periodsPerDay, catalog, usedSubjects, teachers, classes, requirements);
    this.assignWishes(instance, rng, params.wishShare);
    return { instance, hidden };
  }

  private layOutClass(cls: SchoolClass, hours: Record<string, number>, periodsPerDay: number, rng: Rng): Map<string, number[]> {
    const total = Object.values(hours).reduce((a, b) => a + b, 0);
    const capacity = Array.from({ length: DAYS }, (_, d) => Math.floor(total / DAYS) + (d < total % DAYS ? 1 : 0));
    rng.shuffle(capacity);

    const days: string[][] = Array.from({ length: DAYS }, () => []);
    const subjects = Object.keys(hours).sort((a, b) => hours[b] - hours[a] || a.localeCompare(b));
    for (const subject of subjects) {
      for (let h = 0; h < hours[subject]; h++) {
        let best = -1;
        let bestScore = Infinity;
        const offset = rng.int(0, DAYS - 1);
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
      rng.shuffle(day);
      day.forEach((subject, p) => slots.get(subject)!.push(d * periodsPerDay + cls.firstPeriod + p));
    });
    return slots;
  }

  private pickTeacher(teachers: DraftTeacher[], group: string, slots: number[], maxLoad: number, exclude: DraftTeacher[]): DraftTeacher {
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

  private finishTeacher(t: DraftTeacher, periodsPerDay: number, share: number, rng: Rng): Teacher {
    if (!rng.chance(share)) return { id: t.id };
    const freeDays: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      let free = true;
      for (let p = 0; p < periodsPerDay && free; p++) free = !t.busy.has(d * periodsPerDay + p);
      if (free) freeDays.push(d);
    }
    if (freeDays.length === 0) return { id: t.id };
    rng.shuffle(freeDays);
    const daysOff = freeDays.slice(0, 1 + rng.int(0, Math.min(2, freeDays.length) - 1)).sort((a, b) => a - b);
    const unavailable: [number, number][] = [];
    for (const d of daysOff) for (let p = 0; p < periodsPerDay; p++) unavailable.push([d, p]);
    return { id: t.id, unavailable };
  }
}
