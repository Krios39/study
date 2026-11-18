import { Rng } from "../core/rng.ts";
import type { Instance, Requirement, SchoolClass, Teacher } from "../model.ts";
import {
  DAYS,
  GRADES,
  InstanceGenerator,
  PERIODS_PER_SHIFT,
  type GeneratedInstance,
  type GeneratorParams,
} from "./instance-generator.ts";

export type InstanceSize = "small" | "medium" | "large";

export interface RandomParams extends GeneratorParams {
  name?: string;
  size?: InstanceSize;
  shifts?: 1 | 2;
  loadRange?: [min: number, max: number];
  largeClassShare?: number;
  unavailableShare?: number;
  daysOff?: number;
  daySlack?: number;
}

export interface RandomMeta {
  size: InstanceSize;
  shifts: 1 | 2;
  classesPerGrade: Record<string, number>;
  teachersPerGroup: Record<string, number>;
  lessons: number;
  meanLoad: number;
  maxLoad: number;
  maxLoadShare: number;
  minClassSlack: number;
  provablyInfeasible: string[];
}

export interface RandomGenerated extends GeneratedInstance {
  meta: RandomMeta;
}

const SIZE_RANGE: Record<InstanceSize, [number, number]> = { small: [4, 10], medium: [12, 30], large: [35, 60] };

export class RandomGenerator extends InstanceGenerator<RandomParams, RandomGenerated> {
  generate(params: RandomParams): RandomGenerated {
    const rng = new Rng(params.seed);
    const catalog = this.catalog(params);

    const size = params.size ?? rng.pick<InstanceSize>(["small", "medium", "large"]);
    const total = rng.int(...SIZE_RANGE[size]);
    const grades = rng.sample(GRADES, rng.int(2, Math.min(GRADES.length, total))).sort((a, b) => a - b);
    const perGrade = new Map(grades.map((g) => [g, 1]));
    for (let i = grades.length; i < total; i++) {
      const g = rng.pick(grades);
      perGrade.set(g, perGrade.get(g)! + 1);
    }

    const shifts = params.shifts ?? (size === "small" ? 1 : rng.pick<1 | 2>([1, 2]));
    const secondShift = new Set(shifts === 2 ? rng.sample(grades, Math.floor(grades.length / 2)) : []);
    const periodsPerDay = PERIODS_PER_SHIFT * shifts;

    const classes: SchoolClass[] = [];
    for (const grade of grades) {
      const hours = Object.values(this.hoursOf(grade)).reduce((a, b) => a + b, 0);
      const maxPerDay =
        params.daySlack === undefined
          ? this.normalDayLength(grade)
          : Math.min(PERIODS_PER_SHIFT, Math.ceil(hours / DAYS) + params.daySlack);
      for (let i = 0; i < perGrade.get(grade)!; i++) {
        classes.push({
          id: this.classId(grade, i),
          grade,
          firstPeriod: secondShift.has(grade) ? PERIODS_PER_SHIFT : 0,
          maxPerDay,
        });
      }
    }

    const largeShare = params.largeClassShare ?? 0.5;
    const drafts: { cls: SchoolClass; subject: string; group: string; hours: number; teachers: number }[] = [];
    const usedSubjects = new Set<string>();
    for (const cls of classes) {
      const large = rng.chance(largeShare);
      for (const [subject, hours] of Object.entries(this.hoursOf(cls.grade))) {
        const group = this.groupOf(subject);
        drafts.push({ cls, subject, group, hours, teachers: this.isSplit(catalog, subject, large, rng) ? 2 : 1 });
        usedSubjects.add(subject);
      }
    }

    const [loadMin, loadMax] = params.loadRange ?? [12, 24];
    const demand = new Map<string, number>();
    const needTwo = new Set<string>();
    for (const d of drafts) {
      demand.set(d.group, (demand.get(d.group) ?? 0) + d.hours * d.teachers);
      if (d.teachers === 2) needTwo.add(d.group);
    }

    const load = new Map<string, number>();
    const idsByGroup = new Map<string, string[]>();
    const teachersPerGroup: Record<string, number> = {};
    for (const [group, hours] of demand) {
      const fewest = Math.max(needTwo.has(group) ? 2 : 1, Math.ceil(hours / loadMax));
      const most = Math.max(fewest, Math.ceil(hours / loadMin));
      const count = rng.int(fewest, most);
      teachersPerGroup[group] = count;
      const ids = Array.from({ length: count }, (_, i) => `${group}${i + 1}`);
      idsByGroup.set(group, ids);
      for (const id of ids) load.set(id, 0);
    }

    const requirements: Requirement[] = new Array(drafts.length);
    for (const index of rng.shuffle(drafts.map((_, i) => i))) {
      const d = drafts[index];
      const ranked = rng.shuffle([...idsByGroup.get(d.group)!]).sort((a, b) => load.get(a)! - load.get(b)!);
      const chosen = ranked.slice(0, d.teachers);
      for (const id of chosen) load.set(id, load.get(id)! + d.hours);
      requirements[index] = { class: d.cls.id, subject: d.subject, teachers: chosen, hours: d.hours };
    }

    const unavailableShare = params.unavailableShare ?? 0.2;
    const daysOff = params.daysOff ?? 1;
    const teachers: Teacher[] = [];
    for (const ids of idsByGroup.values()) {
      for (const id of ids) {
        if (!rng.chance(unavailableShare)) {
          teachers.push({ id });
          continue;
        }
        const unavailable: [number, number][] = [];
        for (const d of rng.sample([0, 1, 2, 3, 4], daysOff).sort((a, b) => a - b))
          for (let p = 0; p < periodsPerDay; p++) unavailable.push([d, p]);
        teachers.push({ id, unavailable });
      }
    }

    const name = params.name ?? `random-${params.seed}`;
    const instance = this.assemble(name, periodsPerDay, catalog, usedSubjects, teachers, classes, requirements);
    this.assignWishes(instance, rng, params.wishShare);
    return { instance, meta: this.describe(instance, size, shifts, perGrade, teachersPerGroup, load) };
  }

  private describe(
    instance: Instance,
    size: InstanceSize,
    shifts: 1 | 2,
    perGrade: Map<number, number>,
    teachersPerGroup: Record<string, number>,
    load: Map<string, number>,
  ): RandomMeta {
    const nSlots = instance.days * instance.periodsPerDay;
    const provablyInfeasible: string[] = [];
    let maxLoadShare = 0;
    for (const t of instance.teachers) {
      const available = nSlots - (t.unavailable?.length ?? 0);
      const share = load.get(t.id)! / available;
      maxLoadShare = Math.max(maxLoadShare, share);
      if (share > 1) provablyInfeasible.push(`${t.id}: ${load.get(t.id)} lessons in ${available} available slots`);
    }

    const hoursByClass = new Map<string, number>();
    for (const r of instance.requirements) hoursByClass.set(r.class, (hoursByClass.get(r.class) ?? 0) + r.hours);
    let minClassSlack = Infinity;
    for (const c of instance.classes) {
      const slack = c.maxPerDay * instance.days - hoursByClass.get(c.id)!;
      minClassSlack = Math.min(minClassSlack, slack);
      if (slack < 0) provablyInfeasible.push(`${c.id}: ${hoursByClass.get(c.id)} lessons in ${c.maxPerDay * instance.days} slots`);
    }

    const loads = [...load.values()];
    return {
      size,
      shifts,
      classesPerGrade: Object.fromEntries(perGrade),
      teachersPerGroup,
      lessons: instance.requirements.reduce((a, r) => a + r.hours, 0),
      meanLoad: loads.reduce((a, b) => a + b, 0) / loads.length,
      maxLoad: Math.max(...loads),
      maxLoadShare,
      minClassSlack,
      provablyInfeasible,
    };
  }
}
