import { Problem } from "../../src/core/problem.ts";
import type { Curriculum, Instance, LanguageOfInstruction, SubjectDictionary } from "../../src/model.ts";
import { App } from "./app.ts";
import { Dom } from "./dom.ts";
import { Names } from "./names.ts";
import { SchoolDraft, type GroupRow, type Issue } from "./school.ts";
import { Lang } from "./text.ts";

interface Dictionaries {
  subjects: SubjectDictionary;
  curricula: Record<LanguageOfInstruction, Curriculum>;
}

const LANGUAGES: LanguageOfInstruction[] = ["kk", "ru"];
const STEPS = 5;
const MOST_CLASSES = 6;
const MOST_TEACHERS = 12;
const REASONS_SHOWN = 4;
const VERDICTS = { bad: "impossible", warn: "tight", good: "good" };

class Builder {
  private readonly drafts: Record<LanguageOfInstruction, SchoolDraft>;
  private language: LanguageOfInstruction = "kk";
  private readonly root = Dom.find("builder");
  private readonly stage = Dom.find("stage");
  private readonly controls = Dom.find("controls");
  private readonly classes = new Map<number, number>(SchoolDraft.grades.map((grade) => [grade, 1]));
  private readonly teachers = new Map<string, number>();
  private readonly chosen = new Set<string>();
  private readonly closed = new Map<string, number[]>();
  private split = true;
  private shifts = 1;
  private readonly late = new Set<number>(SchoolDraft.secondShift);
  private readonly pinned = new Map<string, string[]>();
  private step = 0;
  private created = false;
  private instance!: Instance;
  private problem!: Problem;
  private app: App | undefined;

  constructor(dictionaries: Dictionaries) {
    const { subjects, curricula } = dictionaries;
    this.drafts = { kk: new SchoolDraft(subjects, curricula.kk), ru: new SchoolDraft(subjects, curricula.ru) };
    this.root.hidden = false;
    this.controls.prepend(Dom.find("tabs"));
    this.root.addEventListener("click", (event) => this.press(event.target as HTMLElement));
    this.root.addEventListener("change", (event) => this.pick(event.target as HTMLInputElement));
    this.update();
  }

  private press(target: HTMLElement) {
    const button = target.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    const { go, grade, group, teacher, third, step, language, shifts, late, shift, link, room } = button.dataset;
    if (language) this.language = language as LanguageOfInstruction;
    if (shifts) this.shifts = Number(shifts);
    if (late && shift === "2") this.late.add(Number(late));
    if (late && shift === "1") this.late.delete(Number(late));
    if (link && room) this.link(link, room);
    if (go === "back") this.step--;
    if (go === "next") this.step++;
    if (go === "edit") this.created = false;
    if (go === "create") this.created = true;
    if (grade && step) this.classes.set(Number(grade), Math.max(1, Math.min(MOST_CLASSES, this.classes.get(Number(grade))! + Number(step))));
    else if (grade && this.classes.has(Number(grade))) this.classes.delete(Number(grade));
    else if (grade) this.classes.set(Number(grade), 1);
    if (group) {
      this.teachers.set(group, Math.max(1, Math.min(MOST_TEACHERS, this.teachers.get(group)! + Number(step))));
      this.chosen.add(group);
    }
    if (teacher && third) {
      const thirds = this.closed.get(teacher) ?? [];
      const at = Number(third);
      this.closed.set(teacher, thirds.includes(at) ? thirds.filter((other) => other !== at) : [...thirds, at]);
    }
    this.update();
    if (go === "create") this.launch();
  }

  private pick(target: HTMLInputElement) {
    if (target.id === "split") this.split = target.checked;
    this.update();
  }

  private launch() {
    this.problem = Problem.from(this.instance);
    if (this.app) this.app.reload();
    else this.app = new App(() => this.problem, true);
    this.stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private update() {
    const draft = this.drafts[this.language];
    const groups = draft.groups(this.classes, this.split);
    for (const group of [...this.teachers.keys()]) if (!groups.some((row) => row.group === group)) this.teachers.delete(group);
    for (const row of groups) if (!this.chosen.has(row.group) || !this.teachers.has(row.group)) this.teachers.set(row.group, row.suggested);
    this.instance = draft.instance(this.classes, new Map(groups.map((row) => [row.group, this.teachers.get(row.group)!])), this.closed, this.split, this.lateGrades, this.pinned);
    this.stage.hidden = !this.created;
    this.controls.hidden = !this.created;
    this.root.classList.toggle("wizarding", !this.created);
    const scrolled = this.root.querySelector(".people")?.scrollTop ?? 0;
    this.root.innerHTML = this.created ? this.summary() : this.wizard(groups);
    const list = this.root.querySelector(".people");
    if (list) list.scrollTop = scrolled;
  }

  private wizard(groups: GroupRow[]): string {
    const labels = Array.from({ length: STEPS }, (_, index) => Lang.t(`wizard.step.${index}`));
    const chips = labels.map((label, index) => `<li class="${index === this.step ? "on" : index < this.step ? "past" : ""}"><em>${index + 1}</em>${label}</li>`).join("");
    const last = this.step === STEPS - 1;
    const empty = this.classes.size === 0;
    const forward = last
      ? `<button class="primary" data-go="create">${Lang.t("wizard.create")}</button>`
      : `<button class="primary" data-go="next"${empty ? " disabled" : ""}>${Lang.t("wizard.next", { step: labels[this.step + 1].toLowerCase() })}</button>`;
    const back = this.step > 0 ? `<button class="plain" data-go="back">${Lang.t("wizard.back")}</button>` : "";
    const body = [() => this.gradesStep(), () => this.classesStep(), () => this.teachersStep(groups), () => this.linksStep(), () => this.preferencesStep()][this.step]();
    const verdict = this.step >= 2 ? this.banner() : "";
    return `<ol class="wizard">${chips}</ol><div class="make">${body}</div>${verdict}<div class="nav">${back}${forward}</div>`;
  }

  private stepper(key: string, value: string, count: number): string {
    return (
      `<span class="stepper"><button data-step="-1" data-${key}="${value}" aria-label="${Lang.t("wizard.fewer")}">−</button><b>${count}</b>` +
      `<button data-step="1" data-${key}="${value}" aria-label="${Lang.t("wizard.more")}">+</button></span>`
    );
  }

  private get lessons(): number {
    return this.instance.requirements.reduce((sum, requirement) => sum + requirement.hours, 0);
  }

  private get doubled(): boolean {
    return SchoolDraft.doubled(this.classes, this.lateGrades);
  }

  private get lateGrades(): Set<number> {
    return this.shifts === 2 ? this.late : new Set<number>();
  }

  private gradesStep(): string {
    const tiles = SchoolDraft.grades
      .map((grade) => `<button class="grade${this.classes.has(grade) ? " on" : ""}" data-grade="${grade}" aria-pressed="${this.classes.has(grade)}"><b>${grade}</b><small>${Lang.t("grades.tile")}</small></button>`)
      .join("");
    const note =
      this.classes.size === 0
        ? `<p class="sum bad">${Lang.t("grades.none")}</p>`
        : `<p class="sum">${Lang.t("grades.picked", { picked: this.classes.size, all: SchoolDraft.grades.length })}</p>`;
    const languages = LANGUAGES.map(
      (language) => `<button class="${language === this.language ? "on" : ""}" data-language="${language}" aria-pressed="${language === this.language}">${Lang.t(`language.${language}`)}</button>`,
    ).join("");
    const second: LanguageOfInstruction = this.language === "kk" ? "ru" : "kk";
    const name = Lang.t(`language.${this.language}`);
    const hint = Lang.t("grades.language.hint", { language: name, other: Lang.t(`language.${second}`), easy: this.hardness(this.language), hard: this.hardness(second) });
    const choice = `<div class="switch"><span>${Lang.t("grades.language")}<small>${hint}</small></span><div>${languages}</div></div>`;
    return `${choice}<h2>${Lang.t("grades.title")}</h2><p>${Lang.t("grades.text", { language: name })}</p><div class="grades">${tiles}</div>${note}`;
  }

  private hardness(language: LanguageOfInstruction): number {
    return this.drafts[this.language].difficulty(language === "kk" ? "kazakh_language" : "russian_language");
  }

  private classesStep(): string {
    const two = this.shifts === 2;
    const rows = [...this.classes]
      .sort((a, b) => a[0] - b[0])
      .map(([grade, count]) => {
        const shift = [1, 2]
          .map((at) => {
            const on = this.late.has(grade) === (at === 2);
            return `<button class="${on ? "on" : ""}" data-late="${grade}" data-shift="${at}" aria-pressed="${on}">${Lang.t(`classes.shift.${at}`)}</button>`;
          })
          .join("");
        return (
          `<li><span>${Lang.t("classes.grade", { grade })}</span>${two ? `<span class="pair">${shift}</span>` : ""}` +
          `${this.stepper("grade", String(grade), count)}<small>${Lang.t("classes.count", { n: count })}</small></li>`
        );
      })
      .join("");
    const options = [1, 2]
      .map((count) => `<button class="${count === this.shifts ? "on" : ""}" data-shifts="${count}" aria-pressed="${count === this.shifts}">${Lang.t(count === 1 ? "classes.shifts.one" : "classes.shifts.two")}</button>`)
      .join("");
    const lost = two && !this.doubled ? Lang.t("classes.shifts.lost") : "";
    const choice = `<div class="switch"><span>${Lang.t("classes.shifts")}<small>${Lang.t("classes.shifts.hint")}${lost}</small></span><div>${options}</div></div>`;
    const subjects = this.drafts[this.language].splitSubjects.map((subject) => Names.title(subject)).join(", ");
    return (
      `${choice}<h2>${Lang.t("classes.title")}</h2><p>${Lang.t("classes.text", { most: MOST_CLASSES })}</p><ul>${rows}</ul>` +
      `<label class="option"><input type="checkbox" id="split"${this.split ? " checked" : ""}> ${Lang.t("classes.split", { subjects })}</label>` +
      `<p class="sum">${Lang.t("classes.sum", { classes: this.instance.classes.length, lessons: this.lessons })}</p>`
    );
  }

  private teachersStep(groups: GroupRow[]): string {
    const loads = SchoolDraft.rows(this.instance);
    const rows = groups
      .map(({ group, hours }) => {
        const mine = loads.filter((row) => row.group === group);
        const heaviest = Math.max(...mine.map((row) => row.load));
        const tone = mine.some((row) => row.load > row.free) ? "bad" : "";
        return (
          `<li><span>${Lang.t(`group.${group}`)}<small>${Lang.t("teachers.hours", { hours })}</small></span>${this.stepper("group", group, this.teachers.get(group)!)}` +
          `<small class="${tone}">${Lang.t("teachers.heaviest", { load: heaviest })}</small></li>`
        );
      })
      .join("");
    return `<h2>${Lang.t("teachers.title")}</h2><p>${Lang.t("teachers.text")}</p><ul>${rows}</ul><p class="sum">${Lang.t("teachers.sum", { teachers: this.instance.teachers.length })}</p>`;
  }

  private linksStep(): string {
    const draft = this.drafts[this.language];
    const links = draft.links(this.instance);
    const loads = SchoolDraft.rows(this.instance);
    const shared = [...this.teachers].filter(([, count]) => count > 1).map(([group]) => group);
    if (shared.length === 0) return `<h2>${Lang.t("links.title")}</h2><p>${Lang.t("links.none")}</p>`;
    const rows = shared
      .flatMap((group) => loads.filter((row) => row.group === group))
      .map((row) => {
        const chips = this.instance.classes
          .filter((cls) => links.has(SchoolDraft.linkKey(cls.id, row.group)))
          .map((cls) => {
            const on = links.get(SchoolDraft.linkKey(cls.id, row.group))!.includes(row.id);
            return `<button class="chip${on ? " on" : ""}" data-link="${row.id}" data-room="${cls.id}" aria-pressed="${on}">${cls.id}</button>`;
          })
          .join("");
        const label = `${Lang.t(`group.${row.group}`)} · ${Lang.t("links.load", { load: row.load })}`;
        return `<li><span><b>${row.id}</b><small class="${row.load > row.free ? "bad" : ""}">${label}</small></span><span class="chips">${chips}</span></li>`;
      })
      .join("");
    return `<h2>${Lang.t("links.title")}</h2><p>${Lang.t("links.text")}</p><ul class="people">${rows}</ul>`;
  }

  private link(teacher: string, room: string) {
    const draft = this.drafts[this.language];
    const group = teacher.replace(/\d+$/, "");
    const links = draft.links(this.instance);
    const key = SchoolDraft.linkKey(room, group);
    const current = links.get(key) ?? [];
    if (current.includes(teacher)) return;
    for (const [other, chosen] of links) if (other.endsWith(`:${group}`)) this.pinned.set(other, chosen);
    this.pinned.set(key, current.length <= 1 ? [teacher] : [...current.slice(1), teacher]);
  }

  private preferencesStep(): string {
    const { doubled } = this;
    const perShift = SchoolDraft.partsPerShift;
    const perDay = SchoolDraft.parts.length;
    const head = Array.from({ length: SchoolDraft.days }, (_, day) => `<b>${Names.day(day)}</b>`).join("");
    const rows = SchoolDraft.rows(this.instance)
      .map((row) => {
        const closed = this.closed.get(row.id) ?? [];
        const lines = (doubled ? row.shifts : [0])
          .map((shift) => {
            const days = Array.from({ length: SchoolDraft.days }, (_, day) => {
              const cells = SchoolDraft.parts
                .slice(shift * perShift, (shift + 1) * perShift)
                .map(([first, last], part) => {
                  const at = day * perDay + shift * perShift + part;
                  const label = `${first + 1}–${last + 1}`;
                  const name = Lang.t("preferences.cell", { teacher: row.id, day: Names.day(day), part: label });
                  return `<button class="third${closed.includes(at) ? " off" : ""}" data-teacher="${row.id}" data-third="${at}" aria-pressed="${closed.includes(at)}" aria-label="${name}">${label}</button>`;
                })
                .join("");
              return `<span>${cells}</span>`;
            }).join("");
            const label = doubled ? `<i>${Lang.t(`classes.shift.${shift + 1}`)}</i>` : "";
            return `<span class="shiftrow">${label}<span class="week">${days}</span></span>`;
          })
          .join("");
        const load = Lang.t("preferences.load", { load: row.load, free: row.free });
        return `<li><span><b>${row.id}</b><small class="${row.load > row.free ? "bad" : ""}">${load}</small></span><span class="shifts">${lines}</span></li>`;
      })
      .join("");
    return (
      `<h2>${Lang.t("preferences.title")}</h2><p>${Lang.t(doubled ? "preferences.text.shift" : "preferences.text.day")}</p>` +
      `<div class="weekhead"><span></span><span class="week">${head}</span></div><ul class="people">${rows}</ul>`
    );
  }

  private summary(): string {
    const off = this.instance.teachers.filter((teacher) => (teacher.unavailable ?? []).length > 0).length;
    const text = Lang.t(this.doubled ? "summary.text.shifts" : "summary.text", {
      language: Lang.t(`language.${this.language}`),
      classes: this.instance.classes.length,
      lessons: this.lessons,
      teachers: this.instance.teachers.length,
    });
    return (
      `<div class="made"><span>${text}${off > 0 ? Lang.t("summary.closed", { n: off }) : ""}.</span>` +
      `<button class="plain" data-go="edit">${Lang.t("summary.edit")}</button></div>${this.banner()}`
    );
  }

  private banner(): string {
    const verdict = SchoolDraft.verdict(this.instance);
    const line = (issue: Issue) => Lang.t(issue.key, issue.subject ? { ...issue.params, subject: Names.title(issue.subject) } : issue.params);
    const list = (issues: Issue[]) => {
      const rest = issues.length > REASONS_SHOWN ? `<li>${Lang.t("verdict.more", { n: issues.length - REASONS_SHOWN })}</li>` : "";
      return `<ul>${issues.slice(0, REASONS_SHOWN).map((issue) => `<li>${line(issue)}</li>`).join("")}${rest}</ul>`;
    };
    const block = (tone: keyof typeof VERDICTS, issues: Issue[]) =>
      `<div class="verdict ${tone}"><b>${Lang.t(`verdict.${VERDICTS[tone]}.title`)}</b>${issues.length > 0 ? list(issues) : ""}<span>${Lang.t(`verdict.${VERDICTS[tone]}.text`)}</span></div>`;
    if (verdict.impossible.length > 0) return block("bad", verdict.impossible);
    if (verdict.tight.length > 0) return block("warn", verdict.tight);
    return block("good", []);
  }
}

Lang.apply();
const other = Dom.find<HTMLAnchorElement>("other");
other.href = "index.html";
other.textContent = Lang.t("link.examples");
new Builder(JSON.parse(Dom.find("data").textContent ?? "{}") as Dictionaries);
