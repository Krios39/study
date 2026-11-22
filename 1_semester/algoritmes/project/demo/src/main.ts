import { Problem } from "../../src/core/problem.ts";
import type { Instance } from "../../src/model.ts";
import { App } from "./app.ts";
import { Dom } from "./dom.ts";

interface School {
  language: string;
  instance: Instance;
}

const DEFAULT_SCHOOL = "small-7";

const schools = JSON.parse(Dom.find("data").textContent ?? "[]") as School[];
const problems = new Map<number, Problem>();
const select = Dom.make("select");
schools.forEach(({ instance, language }, index) => {
  const lessons = instance.requirements.reduce((sum, requirement) => sum + requirement.hours, 0);
  const shifts = new Set(instance.classes.map((cls) => cls.firstPeriod)).size;
  const option = Dom.make("option");
  option.value = String(index);
  option.textContent = `${instance.name} — ${language}-language, ${instance.classes.length} classes, ${lessons} lessons${shifts > 1 ? ", 2 shifts" : ""}`;
  option.selected = instance.name === DEFAULT_SCHOOL;
  select.append(option);
});
const field = Dom.make("label", "field", "<span>School</span>");
field.append(select);
Dom.find("setup").append(field);
const other = Dom.find<HTMLAnchorElement>("other");
other.href = "school.html";
other.textContent = "Build your own school →";

const app = new App(() => {
  const index = Number(select.value);
  let problem = problems.get(index);
  if (!problem) {
    problem = Problem.from(schools[index].instance);
    problems.set(index, problem);
  }
  return problem;
});
select.addEventListener("change", () => app.reload());
