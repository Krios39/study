import type { Args } from "./args.ts";

export abstract class Command {
  abstract readonly name: string;
  abstract readonly summary: string;

  abstract run(args: Args): Promise<void> | void;
}
