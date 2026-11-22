export type Tone = "good" | "warn" | "bad" | "kempe" | "plain";

export class Theme {
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly allowed: string;
  readonly onAccent: string;
  private readonly tones: Record<Tone, string>;

  private constructor(read: (name: string) => string) {
    this.ink = read("--ink");
    this.muted = read("--muted");
    this.line = read("--line");
    this.allowed = read("--allowed");
    this.onAccent = read("--on-accent");
    this.tones = { good: read("--good"), warn: read("--warn"), bad: read("--bad"), kempe: read("--kempe"), plain: read("--accent") };
  }

  static read(): Theme {
    const style = getComputedStyle(document.documentElement);
    return new Theme((name) => style.getPropertyValue(name).trim());
  }

  tone(tone: Tone): string {
    return this.tones[tone];
  }
}
