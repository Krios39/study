import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { Loader } from "../src/io/loader.ts";

const DATA_FILES = ["../src/model.ts", "src/main.ts", "src/builder.ts"];
const SHORTEST_NAME = 3;

class DemoBuilder {
  private readonly renamed = DemoBuilder.ownMembers();

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
    { file: `${name}-kk`, title: `${name}-kk`, language: "Kazakh" },
    { file: name, title: `${name}-ru`, language: "Russian" },
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
      DemoBuilder.SCHOOLS.map((school) => ({ title: school.title, language: school.language, instance: Loader.instance(DemoBuilder.path(`../instances/${school.file}.json`)) })),
    );
  }

  private async bundle(entry: string): Promise<string> {
    const result = await build({
      entryPoints: [DemoBuilder.path(entry)],
      bundle: true,
      format: "iife",
      target: "es2020",
      minify: true,
      mangleProps: this.renamed,
      legalComments: "none",
      write: false,
    });
    return result.outputFiles[0].text;
  }

  private static ownMembers(): RegExp {
    const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const walk = (node: ts.Node, visit: (node: ts.Node) => void) => {
      visit(node);
      ts.forEachChild(node, (child) => walk(child, visit));
    };
    const memberName = (node: ts.Node): string | undefined => {
      const member = ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isAccessor(node) || ts.isPropertySignature(node) || ts.isMethodSignature(node);
      return member && ts.isIdentifier(node.name) ? node.name.text : undefined;
    };
    const sources = [DemoBuilder.path("../src"), DemoBuilder.path("src")]
      .flatMap((folder) => readdirSync(folder, { recursive: true, encoding: "utf8" }).map((file) => join(folder, file)))
      .filter((file) => file.endsWith(".ts"));
    const library = dirname(createRequire(import.meta.url).resolve("typescript"));
    const kept = new Set<string>();
    for (const file of readdirSync(library).filter((name) => /^lib\..*\.d\.ts$/.test(name))) {
      walk(parse(join(library, file)), (node) => {
        const name = memberName(node);
        if (name) kept.add(name);
      });
    }
    for (const file of DATA_FILES) {
      walk(parse(DemoBuilder.path(file)), (node) => {
        const name = memberName(node);
        if (name) kept.add(name);
      });
    }
    const own = new Set<string>();
    for (const file of sources) {
      walk(parse(file), (node) => {
        const name = memberName(node);
        if (name) own.add(name);
        if (ts.isStringLiteralLike(node)) kept.add(node.text);
        if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
          for (const match of node.text.matchAll(/data-([a-z]+)/g)) kept.add(match[1]);
        }
      });
    }
    const names = [...own].filter((name) => name.length >= SHORTEST_NAME && !kept.has(name)).sort();
    console.log(`renaming ${names.length} of ${own.size} own members`);
    return new RegExp(`^(${names.join("|")})$`);
  }

  private static embed(text: string): string {
    return text.replaceAll("</script", "<\\/script");
  }

  private static path(relative: string): string {
    return fileURLToPath(new URL(relative, import.meta.url));
  }
}

await new DemoBuilder().run();
