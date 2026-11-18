export interface CostWeights {
  hard: number;
  difficulty: number;
  sameSubjectInDay: number;
  teacherGap: number;
  shiftBreak: number;
  shiftIdle: number;
  dayImbalance: number;
  dayLoadSquare: number;
  misplaced: number;
  teacherWish: number;
}

export type SoftTerm = Exclude<keyof CostWeights, "hard">;

export const DEFAULT_COST_WEIGHTS: CostWeights = {
  hard: 1000,
  difficulty: 5,
  sameSubjectInDay: 100,
  teacherGap: 3,
  shiftBreak: 10,
  shiftIdle: 2,
  dayImbalance: 2,
  dayLoadSquare: 0,
  misplaced: 10,
  teacherWish: 50,
};

export const SOFT_TERMS: readonly SoftTerm[] = [
  "difficulty",
  "sameSubjectInDay",
  "teacherGap",
  "shiftBreak",
  "shiftIdle",
  "dayImbalance",
  "dayLoadSquare",
  "misplaced",
  "teacherWish",
];

export const HEAVY_FROM = 9;
export const EASY_UP_TO = 6;

export interface HardViolations {
  classClash: number;
  teacherClash: number;
  unassigned: number;
  classSlot: number;
  classGap: number;
  teacherUnavailable: number;
  total: number;
}

export interface SoftStats {
  sameSubjectInDay: number;
  dayImbalance: number;
  teacherGaps: number;
  worstTeacherGaps: number;
  shiftBreaks: number;
  shiftIdle: number;
  difficultySpread: number;
  misplaced: number;
  wishesBroken: number;
}

export interface Evaluation {
  hard: HardViolations;
  soft: SoftStats;
  cost: number;
  softCost: number;
}

export class Weights {
  static resolve(overrides: Partial<CostWeights> = {}): CostWeights {
    return { ...DEFAULT_COST_WEIGHTS, ...overrides };
  }

  static only(...terms: SoftTerm[]): Partial<CostWeights> {
    const weights: Partial<CostWeights> = {};
    for (const term of SOFT_TERMS) weights[term] = terms.includes(term) ? DEFAULT_COST_WEIGHTS[term] : 0;
    return weights;
  }

  static without(...terms: SoftTerm[]): Partial<CostWeights> {
    const weights: Partial<CostWeights> = {};
    for (const term of terms) weights[term] = 0;
    return weights;
  }
}
