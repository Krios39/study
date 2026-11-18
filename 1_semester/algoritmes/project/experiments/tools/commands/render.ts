import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Problem } from "../../../src/core/problem.ts";

import { Timetable } from "../../../src/core/timetable.ts";
import { BASE_SCHOOLS, Workspace } from "../workspace.ts";
import { Command } from "../command.ts";

export class RenderCommand extends Command {
  readonly name = "render";
  readonly summary = "Build the HTML page with timetables of the project schools";

  async run() {

    const data = BASE_SCHOOLS.map((name) => {
      const instance = Workspace.instance(name);
      const problem = Problem.from(instance);

      const solutions: { label: string; note: string; slotOf: number[] }[] = [
        {
          label: "DSATUR по свободным слотам",
          note: "Следующим ставится урок, у которого осталось меньше всего реально свободных слотов (допустимых и не занятых соседями). Слот берётся с наименьшим штрафом.",
          slotOf: Array.from(
            Dsatur.recommended().solve(problem).slotOf,
          ),
        },
        {
          label: "DSATUR с выбором слота",
          note: "Порядок уроков классический, а слот берётся с наименьшим штрафом: окно у класса, повтор предмета в этот день, загруженность дня.",
          slotOf: Array.from(new Dsatur({ respectAllowed: true, slotRule: "leastPenalty" }).solve(problem).slotOf),
        },
        {
          label: "DSATUR с запретами",
          note: "Классический порядок и первый свободный слот, но слоты вне смены класса и недоступные учителю пропускаются.",
          slotOf: Array.from(new Dsatur({ respectAllowed: true }).solve(problem).slotOf),
        },
        {
          label: "DSATUR классический",
          note: "Только граф конфликтов: смена класса и недоступность учителей не учитываются.",
          slotOf: Array.from(new Dsatur().solve(problem).slotOf),
        },
      ];
      const annealedPath = Workspace.path(`instances/${name}.annealed.json`);
      if (existsSync(annealedPath)) {
        solutions.unshift({
          label: "Отжиг",
          note: "Расписание DSATUR по свободным слотам, улучшенное отжигом (перенос, обмен и цепочки Кемпе). В цене: жёсткие нарушения, сложность по дням, повторы, окна учителей, переходы и простой между сменами, половины дня, пожелания, перекос дней.",
          slotOf: (JSON.parse(readFileSync(annealedPath, "utf8")) as { slotOf: number[] }).slotOf,
        });
      }
      const hiddenPath = Workspace.path(`instances/${name}.hidden.json`);
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
        teacherWish: instance.teachers.map((t) => t.wish ?? null),
        difficulty: Object.fromEntries(instance.subjects.map((s) => [s.id, s.difficulty])),
        teacherOff: instance.teachers.map((t) => (t.unavailable ?? []).map(([d, p]) => problem.slot(d, p))),
        lessons: Array.from({ length: problem.nLessons }, (_, l) => [
          problem.lessonClass[l],
          instance.subjects[problem.lessonSubject[l]].id,
          Array.from(problem.teachersOf(l)),
        ]),
        solutions: solutions.map((s) => ({
          ...s,
          violations: Timetable.from(problem, Int32Array.from(s.slotOf)).violations(),
          soft: Timetable.from(problem, Int32Array.from(s.slotOf)).soft(),
        })),
      };
    });

    const template = readFileSync(Workspace.path("viz/template.html"), "utf8");
    if (!template.includes("/*DATA*/null")) throw new Error("template has no data placeholder");
    const html = template.replace("/*DATA*/null", () => JSON.stringify(data).replace(/</g, "\\u003c"));
    writeFileSync(Workspace.path("viz/dsatur.html"), html);
    console.log(`viz/dsatur.html: ${(html.length / 1024).toFixed(0)} KB, ${data.length} instances`);
  }
}
