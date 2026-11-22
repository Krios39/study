import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Loader } from "../src/io/loader.ts";

class DemoBuilder {
  static readonly SCHOOLS = [
    "mini",
    "small-7",
    "small-10",
    "medium-20",
    "medium-30",
    "large-60",
    "heavy-1",
    "heavy-2",
    "heavy-4",
    "large-100-1shift-1",
    "large-100-2shift-1",
  ].flatMap((name) => [
    { file: name, language: "Russian" },
    { file: `${name}-kk`, language: "Kazakh" },
  ]);

  static readonly FONTS = [
    { file: "rubik-latin.woff2", range: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
    { file: "rubik-cyrillic.woff2", range: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  ];

  async run() {
    await this.write("index.html", "src/main.ts", this.schools());
    await this.write("school.html", "src/builder.ts", this.dictionaries());
  }

  private async write(file: string, entry: string, data: string) {
    const page = readFileSync(DemoBuilder.path("src/page.html"), "utf8");
    const bundle = DemoBuilder.embed(await this.bundle(entry));
    const html = page.replace("/*FONTS*/", () => this.fonts()).replace("/*DATA*/", () => DemoBuilder.embed(data)).replace("/*BUNDLE*/", () => bundle);
    const target = DemoBuilder.path(file);
    writeFileSync(target, html);
    console.log(`${target}: ${Math.round(html.length / 1024)} KB`);
  }

  private dictionaries(): string {
    const subjects = Loader.subjects(DemoBuilder.path("../instances/subjects.json"));
    const curriculum = (file: string) => Loader.curriculum(DemoBuilder.path(`../instances/${file}`), subjects);
    return JSON.stringify({ subjects, curricula: { kk: curriculum("curriculum-kk.json"), ru: curriculum("curriculum.json") } });
  }

  private fonts(): string {
    return DemoBuilder.FONTS.map((font) => {
      const data = readFileSync(DemoBuilder.path(`fonts/${font.file}`)).toString("base64");
      return `@font-face { font-family: Rubik; font-style: normal; font-weight: 400 700; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2"); unicode-range: ${font.range}; }`;
    }).join("\n");
  }

  private schools(): string {
    return JSON.stringify(
      DemoBuilder.SCHOOLS.map((school) => ({ language: school.language, instance: Loader.instance(DemoBuilder.path(`../instances/${school.file}.json`)) })),
    );
  }

  private async bundle(entry: string): Promise<string> {
    const result = await build({
      entryPoints: [DemoBuilder.path(entry)],
      bundle: true,
      format: "iife",
      target: "es2020",
      minify: true,
      write: false,
    });
    return result.outputFiles[0].text;
  }

  private static embed(text: string): string {
    return text.replaceAll("</script", "<\\/script");
  }

  private static path(relative: string): string {
    return fileURLToPath(new URL(relative, import.meta.url));
  }
}

await new DemoBuilder().run();
