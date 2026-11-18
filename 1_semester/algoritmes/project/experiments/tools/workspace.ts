import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Problem } from "../../src/core/problem.ts";
import { Loader } from "../../src/io/loader.ts";
import type { Curriculum, Instance, Solution, SubjectDictionary } from "../../src/model.ts";

export const BASE_SCHOOLS = ["mini", "small-7", "small-10", "medium-20", "medium-30", "large-60", "heavy-1", "heavy-2", "heavy-4"];

export class Workspace {
  static path(relative: string): string {
    return fileURLToPath(new URL(`../../${relative}`, import.meta.url));
  }

  static dictionaries(): { subjects: SubjectDictionary; curriculum: Curriculum } {
    const subjects = Loader.subjects(Workspace.path("instances/subjects.json"));
    const curriculum = Loader.curriculum(Workspace.path("instances/curriculum.json"), subjects);
    return { subjects, curriculum };
  }

  static instance(name: string): Instance {
    return Loader.instance(Workspace.path(`instances/${name}.json`));
  }

  static problem(name: string): Problem {
    return Problem.from(Workspace.instance(name));
  }

  static savedSolution(name: string, kind: "annealed" | "hidden"): Solution | undefined {
    const path = Workspace.path(`instances/${name}.${kind}.json`);
    if (!existsSync(path)) return undefined;
    return Int32Array.from((JSON.parse(readFileSync(path, "utf8")) as { slotOf: number[] }).slotOf);
  }
}
