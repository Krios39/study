import type { DictionarySubject, LanguageOfInstruction, SplitRule, Subject, SubjectDictionary } from "../model.ts";

export class SubjectCatalog {
  readonly dictionary: SubjectDictionary;
  readonly language: LanguageOfInstruction;
  private readonly byId: Map<string, DictionarySubject>;

  constructor(dictionary: SubjectDictionary, language: LanguageOfInstruction) {
    this.dictionary = dictionary;
    this.language = language;
    this.byId = new Map(dictionary.subjects.map((s) => [s.id, s]));
  }

  static difficultyOf(subject: DictionarySubject, language: LanguageOfInstruction): number {
    return typeof subject.difficulty === "number" ? subject.difficulty : subject.difficulty[language];
  }

  static splitOf(subject: DictionarySubject, language: LanguageOfInstruction): SplitRule | "none" {
    if (subject.split === undefined) return "none";
    return typeof subject.split === "string" ? subject.split : (subject.split[language] ?? "none");
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  difficulty(id: string): number {
    return SubjectCatalog.difficultyOf(this.get(id), this.language);
  }

  split(id: string): SplitRule | "none" {
    return SubjectCatalog.splitOf(this.get(id), this.language);
  }

  idsWithSplit(rule: SplitRule): string[] {
    return this.dictionary.subjects.filter((s) => SubjectCatalog.splitOf(s, this.language) === rule).map((s) => s.id);
  }

  subjects(ids?: Iterable<string>): Subject[] {
    const list = ids ? Array.from(ids, (id) => this.get(id)) : this.dictionary.subjects;
    return list.map((s) => ({ id: s.id, difficulty: SubjectCatalog.difficultyOf(s, this.language) }));
  }

  private get(id: string): DictionarySubject {
    const subject = this.byId.get(id);
    if (!subject) throw new Error(`unknown subject "${id}"`);
    return subject;
  }
}
