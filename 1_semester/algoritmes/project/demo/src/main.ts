import { Problem } from "../../src/core/problem.ts";
import type { Instance } from "../../src/model.ts";
import { App } from "./app.ts";
import { Dom } from "./dom.ts";
import { Lang } from "./text.ts";

interface School {
  title: string;
  language: string;
  instance: Instance;
}

const DEFAULT_SCHOOL = "small-7-kk";

Lang.apply();
const schools = JSON.parse(Dom.find("data").textContent ?? "[]") as School[];
const problems = new Map<number, Problem>();
const select = Dom.make("select");
schools.forEach(({ title, instance, language }, index) => {
  const lessons = instance.requirements.reduce((sum, requirement) => sum + requirement.hours, 0);
  const shifts = new Set(instance.classes.map((cls) => cls.firstPeriod)).size;
  const option = Dom.make("option");
  option.value = String(index);
  option.textContent = Lang.t(shifts > 1 ? "school.optionTwoShifts" : "school.option", {
    name: title,
    language: Lang.t(`language.${language}`),
    classes: instance.classes.length,
    lessons,
  });
  option.selected = title === DEFAULT_SCHOOL;
  select.append(option);
});
const field = Dom.make("label", "field", `<span>${Lang.t("school.field")}</span>`);
field.append(select);
Dom.find("setup").append(field);
const other = Dom.find<HTMLAnchorElement>("other");
other.href = "school.html";
other.textContent = Lang.t("link.build");

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
