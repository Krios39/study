export class Args {
  readonly positional: string[] = [];
  private readonly named = new Map<string, string>();

  constructor(argv: string[]) {
    for (let i = 0; i < argv.length; i++) {
      const token = argv[i];
      if (!token.startsWith("--")) {
        this.positional.push(token);
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) this.named.set(token.slice(2), "true");
      else this.named.set(token.slice(2), argv[++i]);
    }
  }

  has(name: string): boolean {
    return this.named.has(name);
  }

  get(name: string): string | undefined {
    return this.named.get(name);
  }

  text(name: string, fallback: string): string {
    return this.named.get(name) ?? fallback;
  }

  number(name: string, fallback: number): number {
    const value = this.named.get(name);
    return value === undefined ? fallback : Number(value);
  }

  list(name: string, fallback: string[]): string[] {
    const value = this.named.get(name);
    return value === undefined ? fallback : value.split(",");
  }

  required(name: string): string {
    const value = this.named.get(name);
    if (value === undefined) throw new Error(`--${name} is required`);
    return value;
  }
}
