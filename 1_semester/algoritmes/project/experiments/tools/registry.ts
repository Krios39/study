import { GenerateCommand } from "./commands/generate.ts";
import { RenderCommand } from "./commands/render.ts";
import { AnnealCommand } from "./commands/anneal.ts";
import { StressCommand } from "./commands/stress.ts";
import { ExperimentCommand } from "./commands/experiment.ts";
import { CompareCommand } from "./commands/compare.ts";
import { HardsetCommand } from "./commands/hardset.ts";
import { HundredCommand } from "./commands/hundred.ts";
import { ReferenceCommand } from "./commands/reference.ts";
import { PartsCommand } from "./commands/parts.ts";
import { MediansCommand } from "./commands/medians.ts";
import { BestofCommand } from "./commands/bestof.ts";
import { XhsttCommand } from "./commands/xhstt.ts";
import { ExportXhsttCommand } from "./commands/export-xhstt.ts";
import { HsevalRandomCommand } from "./commands/hseval-random.ts";
import { HsevalHundredCommand } from "./commands/hseval-hundred.ts";
import { KheCompareCommand } from "./commands/khe-compare.ts";
import { SolveCommand } from "./commands/solve.ts";
import type { Command } from "./command.ts";

export const COMMANDS: Command[] = [
  new SolveCommand(),
  new GenerateCommand(),
  new RenderCommand(),
  new AnnealCommand(),
  new StressCommand(),
  new ExperimentCommand(),
  new CompareCommand(),
  new HardsetCommand(),
  new HundredCommand(),
  new ReferenceCommand(),
  new PartsCommand(),
  new MediansCommand(),
  new BestofCommand(),
  new XhsttCommand(),
  new ExportXhsttCommand(),
  new HsevalRandomCommand(),
  new HsevalHundredCommand(),
  new KheCompareCommand(),
];
