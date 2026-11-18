import type { Problem } from "../core/problem.ts";
import type { Solution } from "../model.ts";

export interface SolveResult {
  slotOf: Solution;
}

export abstract class Solver<R extends SolveResult = SolveResult> {
  abstract readonly name: string;

  abstract solve(problem: Problem, start?: Solution): R;
}
