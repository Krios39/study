export type Tone = "plain" | "good" | "bad" | "warn";

export class Theme {
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly allowed: string;
  readonly surface: string;
  readonly onAccent: string;
  readonly shade: string;
  private readonly tones: Record<Tone, string>;

  private constructor(read: (name: string) => string) {
    this.ink = read("--ink");
    this.muted = read("--muted");
    this.line = read("--line");
    this.allowed = read("--allowed");
    this.surface = read("--surface");
    this.onAccent = read("--on-accent");
    this.shade = read("--shade");
    this.tones = { plain: read("--accent"), good: read("--good"), bad: read("--bad"), warn: read("--warn") };
  }

  static read(): Theme {
    const style = getComputedStyle(document.documentElement);
    return new Theme((name) => style.getPropertyValue(name).trim());
  }

  tone(tone: Tone): string {
    return this.tones[tone];
  }
}
