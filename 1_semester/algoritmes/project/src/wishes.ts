import type { Instance, Teacher, TeacherWish, TeacherWishKind } from "./model.ts";

const PERIODS_PER_SHIFT = 8;
const MAX_OCCUPANCY = 0.6;
const FREE_WINDOWS: [number, number][] = [
  [0, 4],
  [4, 10],
  [11, 15],
];

export function wishOptions(periodsPerDay: number): TeacherWish[] {
  const last = periodsPerDay - 1;
  const options: TeacherWish[] = [];
  if (periodsPerDay > PERIODS_PER_SHIFT) {
    options.push({ kind: "noFirstShift", periods: [0, PERIODS_PER_SHIFT - 1] });
    options.push({ kind: "noSecondShift", periods: [PERIODS_PER_SHIFT, last] });
  }
  for (const [from, to] of FREE_WINDOWS) {
    if (from <= last) options.push({ kind: "freePeriods", periods: [from, Math.min(to, last)] });
  }
  return options;
}

export function isWishFeasible(instance: Instance, teacher: Teacher, wish: TeacherWish): boolean {
  const { days, periodsPerDay } = instance;
  const classHours = new Map<string, number>();
  const ownHours = new Map<string, number>();
  for (const r of instance.requirements) {
    classHours.set(r.class, (classHours.get(r.class) ?? 0) + r.hours);
    if (r.teachers.includes(teacher.id)) ownHours.set(r.class, (ownHours.get(r.class) ?? 0) + r.hours);
  }
  if (ownHours.size === 0) return false;

  const blocked = new Set((teacher.unavailable ?? []).map(([d, p]) => d * periodsPerDay + p));
  const shifts = new Map<number, { hours: number; usable: Set<number> }>();
  for (const [classId, hours] of ownHours) {
    const cls = instance.classes.find((c) => c.id === classId)!;
    const used = Math.min(cls.maxPerDay, Math.ceil(classHours.get(classId)! / days));
    const shift = shifts.get(cls.firstPeriod) ?? { hours: 0, usable: new Set<number>() };
    shifts.set(cls.firstPeriod, shift);
    shift.hours += hours;
    let own = 0;
    for (let d = 0; d < days; d++) {
      for (let p = cls.firstPeriod; p < cls.firstPeriod + used; p++) {
        if (p >= wish.periods[0] && p <= wish.periods[1]) continue;
        if (blocked.has(d * periodsPerDay + p)) continue;
        shift.usable.add(d * periodsPerDay + p);
        own++;
      }
    }
    if (own * MAX_OCCUPANCY < hours) return false;
  }
  for (const shift of shifts.values()) if (shift.hours > shift.usable.size * MAX_OCCUPANCY) return false;
  return true;
}

export function drawWish(random: () => number, instance: Instance, teacher: Teacher): TeacherWish | undefined {
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const feasible = wishOptions(instance.periodsPerDay).filter((wish) => isWishFeasible(instance, teacher, wish));
  if (feasible.length === 0) return undefined;
  const kind = pick<TeacherWishKind>([...new Set(feasible.map((wish) => wish.kind))]);
  return pick(feasible.filter((wish) => wish.kind === kind));
}
