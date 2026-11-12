import { readFileSync } from "node:fs";
import { LANGUAGES_OF_INSTRUCTION, type Curriculum, type Instance, type SubjectDictionary } from "./model.ts";

export class Loader {
  static instance(path: string): Instance {
    const inst = Loader.read<Instance>(path);
    Loader.validateInstance(inst);
    return inst;
  }

  static subjects(path: string): SubjectDictionary {
    const dict = Loader.read<SubjectDictionary>(path);
    Loader.validateSubjects(dict);
    return dict;
  }

  static curriculum(path: string, subjects?: SubjectDictionary): Curriculum {
    const cur = Loader.read<Curriculum>(path);
    Loader.validateCurriculum(cur, subjects);
    return cur;
  }

  static validateInstance(inst: Instance) {
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

    Loader.fail(`invalid instance "${inst.name}"`, errors);
  }

  static validateSubjects(dict: SubjectDictionary) {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const s of dict.subjects) {
      if (seen.has(s.id)) errors.push(`duplicate subject id "${s.id}"`);
      seen.add(s.id);
      const d = s.difficulty;
      const scores = typeof d === "number" ? [d] : LANGUAGES_OF_INSTRUCTION.map((lang) => d[lang]);
      if (!scores.every((score) => score > 0)) errors.push(`subject "${s.id}": difficulty must be positive`);
    }
    Loader.fail("invalid subject dictionary", errors);
  }

  static validateCurriculum(cur: Curriculum, subjects?: SubjectDictionary) {
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
    Loader.fail("invalid curriculum", errors);
  }

  private static read<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  }

  private static fail(what: string, errors: string[]) {
    if (errors.length > 0) throw new Error(`${what}:\n  ${errors.join("\n  ")}`);
  }
}
