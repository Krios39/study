type Entry = string | Record<string, string>;
type Table = Record<string, Entry>;
type Params = Record<string, string | number>;

const FALLBACK = "en";
const STORE = "timetabling-language";

export class Lang {
  private static tables: Record<string, Table> | undefined;
  private static chosen = FALLBACK;
  private static plural = new Intl.PluralRules(FALLBACK);

  static get locale(): string {
    Lang.ready();
    return Lang.chosen;
  }

  static has(key: string): boolean {
    const tables = Lang.ready();
    return key in (tables[Lang.chosen] ?? {}) || key in (tables[FALLBACK] ?? {});
  }

  static number(value: number): string {
    return Math.round(value).toLocaleString(Lang.locale);
  }

  static t(key: string, params: Params = {}): string {
    const tables = Lang.ready();
    const entry = tables[Lang.chosen]?.[key] ?? tables[FALLBACK]?.[key];
    if (entry === undefined) return key;
    const text = typeof entry === "string" ? entry : (entry[Lang.plural.select(Number(params["n"]))] ?? entry["other"] ?? "");
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = params[name];
      if (value === undefined) return whole;
      return typeof value === "number" ? Lang.number(value) : value;
    });
  }

  static apply() {
    const tables = Lang.ready();
    document.title = Lang.t("page.title");
    for (const element of document.querySelectorAll<HTMLElement>("[data-text]")) element.innerHTML = Lang.t(element.getAttribute("data-text")!);
    const locales = Object.keys(tables);
    const holder = document.getElementById("languages");
    if (!holder || locales.length < 2) return;
    for (const locale of locales) {
      const button = document.createElement("button");
      button.textContent = String(tables[locale]["language.self"] ?? locale);
      button.className = locale === Lang.chosen ? "on" : "";
      button.addEventListener("click", () => {
        Lang.remember(locale);
        location.reload();
      });
      holder.append(button);
    }
  }

  private static ready(): Record<string, Table> {
    if (Lang.tables) return Lang.tables;
    if (typeof document === "undefined") return (Lang.tables = {});
    const tables = JSON.parse(document.getElementById("locales")?.textContent ?? "{}") as Record<string, Table>;
    Lang.tables = tables;
    const wanted = [new URLSearchParams(location.search).get("lang"), Lang.remembered(), ...navigator.languages.map((language) => language.split("-")[0])];
    Lang.chosen = wanted.find((locale) => locale && locale in tables) ?? FALLBACK;
    Lang.plural = new Intl.PluralRules(Lang.chosen);
    document.documentElement.lang = Lang.chosen;
    return tables;
  }

  private static remembered(): string | null {
    try {
      return localStorage.getItem(STORE);
    } catch {
      return null;
    }
  }

  private static remember(locale: string) {
    try {
      localStorage.setItem(STORE, locale);
    } catch {
      return;
    }
  }
}
