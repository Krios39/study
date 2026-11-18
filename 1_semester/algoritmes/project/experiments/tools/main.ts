import { Args } from "./args.ts";
import { COMMANDS } from "./registry.ts";

const [name, ...rest] = process.argv.slice(2);
const command = COMMANDS.find((candidate) => candidate.name === name);

if (!command) {
  if (name !== undefined && name !== "help") console.error(`unknown command "${name}"\n`);
  console.log("usage: npm run tools -- <command> [arguments]\n");
  const width = Math.max(...COMMANDS.map((candidate) => candidate.name.length));
  for (const candidate of COMMANDS) console.log(`  ${candidate.name.padEnd(width)}  ${candidate.summary}`);
  process.exitCode = name === undefined || name === "help" ? 0 : 1;
} else {
  await command.run(new Args(rest));
}
