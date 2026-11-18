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

  async run() {
    const page = readFileSync(DemoBuilder.path("src/page.html"), "utf8");
    const schools = DemoBuilder.embed(this.schools());
    const bundle = DemoBuilder.embed(await this.bundle());
    const html = page.replace("/*SCHOOLS*/", () => schools).replace("/*BUNDLE*/", () => bundle);
    const target = DemoBuilder.path("index.html");
    writeFileSync(target, html);
    console.log(`${target}: ${Math.round(html.length / 1024)} KB`);
  }

  private schools(): string {
    return JSON.stringify(
      DemoBuilder.SCHOOLS.map((school) => ({ language: school.language, instance: Loader.instance(DemoBuilder.path(`../instances/${school.file}.json`)) })),
    );
  }

  private async bundle(): Promise<string> {
    const result = await build({
      entryPoints: [DemoBuilder.path("src/main.ts")],
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
