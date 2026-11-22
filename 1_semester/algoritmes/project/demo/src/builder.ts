import { Problem } from "../../src/core/problem.ts";
import type { Curriculum, Instance, LanguageOfInstruction, SubjectDictionary } from "../../src/model.ts";
import { App } from "./app.ts";
import { Dom } from "./dom.ts";
import { Names } from "./names.ts";
import { GROUP_LABELS, SchoolDraft, type GroupRow, type Verdict } from "./school.ts";

interface Dictionaries {
  subjects: SubjectDictionary;
  curricula: Record<LanguageOfInstruction, Curriculum>;
}

const LANGUAGES: Record<LanguageOfInstruction, string> = { kk: "Kazakh", ru: "Russian" };

const STEPS = ["Grades", "Classes", "Teachers", "Preferences"];
const MOST_CLASSES = 6;
const MOST_TEACHERS = 12;
const REASONS_SHOWN = 4;

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
    const { go, grade, group, teacher, third, step, language } = button.dataset;
    if (language) this.language = language as LanguageOfInstruction;
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
    this.instance = draft.instance(this.classes, new Map(groups.map((row) => [row.group, this.teachers.get(row.group)!])), this.closed, this.split);
    this.stage.hidden = !this.created;
    this.controls.hidden = !this.created;
    this.root.classList.toggle("wizarding", !this.created);
    const scrolled = this.root.querySelector(".people")?.scrollTop ?? 0;
    this.root.innerHTML = this.created ? this.summary() : this.wizard(groups);
    const list = this.root.querySelector(".people");
    if (list) list.scrollTop = scrolled;
  }

  private wizard(groups: GroupRow[]): string {
    const chips = STEPS.map((label, index) => `<li class="${index === this.step ? "on" : index < this.step ? "past" : ""}"><em>${index + 1}</em>${label}</li>`).join("");
    const last = this.step === STEPS.length - 1;
    const empty = this.classes.size === 0;
    const forward = last
      ? '<button class="primary" data-go="create">Create the school and build its timetable</button>'
      : `<button class="primary" data-go="next"${empty ? " disabled" : ""}>Next: ${STEPS[this.step + 1].toLowerCase()}</button>`;
    const back = this.step > 0 ? '<button class="plain" data-go="back">Back</button>' : "";
    const body = [() => this.gradesStep(), () => this.classesStep(), () => this.teachersStep(groups), () => this.preferencesStep()][this.step]();
    const verdict = this.step >= 2 ? this.banner() : "";
    return `<ol class="wizard">${chips}</ol><div class="make">${body}</div>${verdict}<div class="nav">${back}${forward}</div>`;
  }

  private stepper(key: string, value: string, count: number): string {
    return `<span class="stepper"><button data-step="-1" data-${key}="${value}" aria-label="fewer">−</button><b>${count}</b><button data-step="1" data-${key}="${value}" aria-label="more">+</button></span>`;
  }

  private get lessons(): number {
    return this.instance.requirements.reduce((sum, requirement) => sum + requirement.hours, 0);
  }

  private gradesStep(): string {
    const tiles = SchoolDraft.grades
      .map((grade) => `<button class="grade${this.classes.has(grade) ? " on" : ""}" data-grade="${grade}" aria-pressed="${this.classes.has(grade)}"><b>${grade}</b><small>grade</small></button>`)
      .join("");
    const note = this.classes.size === 0 ? '<p class="sum bad">Pick at least one grade.</p>' : `<p class="sum">${this.classes.size} of ${SchoolDraft.grades.length} grades picked</p>`;
    const languages = (Object.keys(LANGUAGES) as LanguageOfInstruction[])
      .map((language) => `<button class="${language === this.language ? "on" : ""}" data-language="${language}" aria-pressed="${language === this.language}">${LANGUAGES[language]}</button>`)
      .join("");
    const other = LANGUAGES[this.language === "kk" ? "ru" : "kk"];
    const hint =
      `State schools in Kazakhstan teach either in Kazakh or in Russian. The choice changes the curriculum and how hard two subjects count: ` +
      `here ${LANGUAGES[this.language]} is the language of instruction and counts as easier (${this.hardness(this.language)} points), ${other} is the second language and counts as harder (${this.hardness(this.language === "kk" ? "ru" : "kk")} points).`;
    const choice = `<div class="switch"><span>Language of instruction<small>${hint}</small></span><div>${languages}</div></div>`;
    return `${choice}<h2>Which grades does your school have?</h2><p>Press a grade to add or remove it. Each grade follows the national curriculum for classes taught in ${LANGUAGES[this.language]}.</p><div class="grades">${tiles}</div>${note}`;
  }

  private hardness(language: LanguageOfInstruction): number {
    return this.drafts[this.language].difficulty(language === "kk" ? "kazakh_language" : "russian_language");
  }

  private classesStep(): string {
    const rows = [...this.classes]
      .sort((a, b) => a[0] - b[0])
      .map(([grade, count]) => `<li><span>Grade ${grade}</span>${this.stepper("grade", String(grade), count)}<small>${count === 1 ? "class" : "classes"}</small></li>`)
      .join("");
    return (
      `<h2>How many classes in each grade?</h2><p>From 1 to ${MOST_CLASSES} parallel classes.</p><ul>${rows}</ul>` +
      `<label class="option"><input type="checkbox" id="split"${this.split ? " checked" : ""}> Split each class into two groups for ${this.drafts[this.language].splitSubjects.join(", ")}</label>` +
      `<p class="sum">${this.instance.classes.length} classes · ${this.lessons} lessons a week</p>`
    );
  }

  private teachersStep(groups: GroupRow[]): string {
    const loads = SchoolDraft.rows(this.instance);
    const rows = groups
      .map(({ group, hours }) => {
        const mine = loads.filter((row) => row.group === group);
        const heaviest = Math.max(...mine.map((row) => row.load));
        const tone = mine.some((row) => row.load > row.free) ? "bad" : "";
        return `<li><span>${GROUP_LABELS[group]}<small>${hours} lessons a week</small></span>${this.stepper("group", group, this.teachers.get(group)!)}<small class="${tone}">up to ${heaviest} each</small></li>`;
      })
      .join("");
    return `<h2>How many teachers for each subject?</h2><p>The numbers are a suggestion of about 24 lessons a week per teacher. Fewer teachers means more lessons for each.</p><ul>${rows}</ul><p class="sum">${this.instance.teachers.length} teachers</p>`;
  }

  private preferencesStep(): string {
    const parts = SchoolDraft.parts.map(([first, last]) => `${first + 1}–${last + 1}`);
    const head = Array.from({ length: SchoolDraft.days }, (_, day) => `<b>${Names.day(day)}</b>`).join("");
    const rows = SchoolDraft.rows(this.instance)
      .map((row) => {
        const closed = this.closed.get(row.id) ?? [];
        const days = Array.from({ length: SchoolDraft.days }, (_, day) => {
          const cells = parts
            .map((label, part) => {
              const at = day * parts.length + part;
              return `<button class="third${closed.includes(at) ? " off" : ""}" data-teacher="${row.id}" data-third="${at}" aria-pressed="${closed.includes(at)}" aria-label="${row.id}, ${Names.day(day)}, lessons ${label}">${label}</button>`;
            })
            .join("");
          return `<span>${cells}</span>`;
        }).join("");
        return `<li><span><b>${row.id}</b><small class="${row.load > row.free ? "bad" : ""}">${row.load} lessons, ${row.free} possible times</small></span><span class="week">${days}</span></li>`;
      })
      .join("");
    return (
      `<h2>When can each teacher not work?</h2><p>Every day has three parts: lessons ${parts.join(", ")}. Press a part to close it for that teacher. Close all three for a full day off.</p>` +
      `<div class="weekhead"><span></span><span class="week">${head}</span></div><ul class="people">${rows}</ul>`
    );
  }

  private summary(): string {
    const off = [...this.closed.values()].filter((thirds) => thirds.length > 0).length;
    return (
      `<div class="made"><span><b>Your school:</b> taught in ${LANGUAGES[this.language]}, ${this.instance.classes.length} classes, ${this.lessons} lessons a week, ${this.instance.teachers.length} teachers` +
      `${off > 0 ? `, ${off} with closed times` : ""}.</span><button class="plain" data-go="edit">Change the school</button></div>${this.banner()}`
    );
  }

  private banner(): string {
    const verdict: Verdict = SchoolDraft.verdict(this.instance);
    const list = (lines: string[]) => {
      const rest = lines.length > REASONS_SHOWN ? `<li>… and ${lines.length - REASONS_SHOWN} more</li>` : "";
      return `<ul>${lines.slice(0, REASONS_SHOWN).map((line) => `<li>${line}</li>`).join("")}${rest}</ul>`;
    };
    if (verdict.impossible.length > 0) {
      return `<div class="verdict bad"><b>No valid timetable can exist for this school.</b>${list(verdict.impossible)}<span>Add teachers or reopen some of their times. You can still build it to see where it breaks: lessons that do not fit stay red.</span></div>`;
    }
    if (verdict.tight.length > 0) {
      return `<div class="verdict warn"><b>A timetable may exist, but it will be hard to find.</b>${list(verdict.tight)}<span>If rules stay broken at the end of the run, no valid timetable was found.</span></div>`;
    }
    return '<div class="verdict good"><b>Nothing rules a timetable out.</b><span>Only the run shows whether a valid timetable is really found: this check cannot prove that one exists.</span></div>';
  }
}

const other = Dom.find<HTMLAnchorElement>("other");
other.href = "index.html";
other.textContent = "← Example schools";
new Builder(JSON.parse(Dom.find("data").textContent ?? "{}") as Dictionaries);
