import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dsatur } from "../src/dsatur.ts";
import { hardViolations } from "../src/hard.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { softStats } from "../src/soft.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const names = ["mini", "small-7", "small-10", "medium-20", "medium-30", "large-60"];

const data = names.map((name) => {
  const instance = Loader.instance(file(`instances/${name}.json`));
  const problem = Problem.from(instance);

  const solutions: { label: string; note: string; slotOf: number[] }[] = [
    {
      label: "DSATUR по свободным слотам",
      note: "Следующим ставится урок, у которого осталось меньше всего реально свободных слотов (допустимых и не занятых соседями). Слот берётся с наименьшим штрафом.",
      slotOf: Array.from(
        Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf,
      ),
    },
    {
      label: "DSATUR с выбором слота",
      note: "Порядок уроков классический, а слот берётся с наименьшим штрафом: окно у класса, повтор предмета в этот день, загруженность дня.",
      slotOf: Array.from(Dsatur.solve(problem, { respectAllowed: true, slotRule: "leastPenalty" }).slotOf),
    },
    {
      label: "DSATUR с запретами",
      note: "Классический порядок и первый свободный слот, но слоты вне смены класса и недоступные учителю пропускаются.",
      slotOf: Array.from(Dsatur.solve(problem, { respectAllowed: true }).slotOf),
    },
    {
      label: "DSATUR классический",
      note: "Только граф конфликтов: смена класса и недоступность учителей не учитываются.",
      slotOf: Array.from(Dsatur.solve(problem).slotOf),
    },
  ];
  const hiddenPath = file(`instances/${name}.hidden.json`);
  if (existsSync(hiddenPath)) {
    solutions.push({
      label: "Скрытое расписание",
      note: "Допустимое расписание, из которого генератор вывел требования. Показано для сравнения.",
      slotOf: (JSON.parse(readFileSync(hiddenPath, "utf8")) as { slotOf: number[] }).slotOf,
    });
  }

  return {
    name,
    days: problem.days,
    periods: problem.periods,
    classes: instance.classes.map((c) => ({ id: c.id, first: c.firstPeriod, max: c.maxPerDay })),
    teachers: instance.teachers.map((t) => t.id),
    teacherOff: instance.teachers.map((t) => (t.unavailable ?? []).map(([d, p]) => problem.slot(d, p))),
    lessons: Array.from({ length: problem.nLessons }, (_, l) => [
      problem.lessonClass[l],
      instance.subjects[problem.lessonSubject[l]].id,
      Array.from(problem.teachersOf(l)),
    ]),
    solutions: solutions.map((s) => ({
      ...s,
      violations: hardViolations(problem, Int32Array.from(s.slotOf)),
      soft: softStats(problem, Int32Array.from(s.slotOf)),
    })),
  };
});

const template = readFileSync(file("viz/template.html"), "utf8");
if (!template.includes("/*DATA*/null")) throw new Error("template has no data placeholder");
const html = template.replace("/*DATA*/null", () => JSON.stringify(data).replace(/</g, "\\u003c"));
writeFileSync(file("viz/dsatur.html"), html);
console.log(`viz/dsatur.html: ${(html.length / 1024).toFixed(0)} KB, ${data.length} instances`);
