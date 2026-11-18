import { Weights, type CostWeights } from "../../src/core/cost.ts";

export const COST_PARTS: [name: string, weights: Partial<CostWeights>][] = [
  ["сложность по дням", Weights.only("difficulty")],
  ["повторы", Weights.only("sameSubjectInDay")],
  ["перекос дней", Weights.only("dayImbalance")],
  ["половины дня", Weights.only("misplaced")],
  ["окна и смены учителей", Weights.only("teacherGap", "shiftBreak", "shiftIdle")],
  ["пожелания", Weights.only("teacherWish")],
];
