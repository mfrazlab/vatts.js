import Console from "vatts/console";
import type { CreateAppOptions } from "./types";

function normalizeAliasPrefix(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "@/";

  // Allow users to type "@" or "@/" or "@/*". We normalize to prefix form ("@/").
  if (trimmed.endsWith("/*")) return trimmed.slice(0, -1); // "@/*" -> "@/"
  if (trimmed.endsWith("/")) return trimmed;
  return `${trimmed}/`;
}

function readArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  if (!next || next.startsWith("-")) return undefined;
  return next;
}

export function parseArgs(argv: string[]): CreateAppOptions {
  const args = argv.slice(2);
  const appName = args.find((a) => a.length > 0 && !a.startsWith("-"));

  // flags
  const tailwindFlag = args.includes("--tailwind") || args.includes("-t");
  const noInstallFlag = args.includes("--no-install");
  const installFlag = args.includes("--install");
  const noExamplesFlag = args.includes("--no-examples");
  const examplesFlag = args.includes("--examples");

  const noAliasFlag = args.includes("--no-alias");
  const aliasValue = readArgValue(args, "--alias");

  return {
    appName,
    tailwind: tailwindFlag ? true : undefined,
    // default examples = true (prompt still decides)
    examples: noExamplesFlag ? false : examplesFlag ? true : undefined,
    install: noInstallFlag ? false : installFlag ? true : undefined,

    moduleAlias: noAliasFlag ? false : aliasValue ? true : undefined,
    alias: aliasValue ? normalizeAliasPrefix(aliasValue) : undefined,
  };
}

export async function promptForMissingOptions(opts: CreateAppOptions): Promise<Required<Omit<CreateAppOptions, "appName">> & { appName: string }> {
  let appName = opts.appName
  if (appName === undefined) {
    appName = await Console.ask("What is the name of your app?", "my-vatts-app");
    console.log("             ")
  }

  let typescript = opts.typeScript
  if(typescript === undefined) {
    typescript = await Console.confirm("Do you want to use typescript?", true)
    console.log("  ")
  }


  let tailwind = opts.tailwind;
  if (tailwind === undefined) {
    tailwind = await Console.confirm("Do you want to include Tailwind CSS?", true);
    console.log("             ")
  }


  let examples = opts.examples;
  if (examples === undefined) {
    examples = await Console.confirm("Do you want to include example routes?", true);
    console.log(" ")
  }

  let pathRouter = opts.pathRouter
  if(pathRouter === undefined) {
    pathRouter = await Console.confirm("Do you want to use path router?", false)
    console.log(" ")
  }

  let moduleAlias = opts.moduleAlias;
  if (moduleAlias === undefined) {
    moduleAlias = await Console.confirm("Do you want to set a module alias?", true);
    console.log(" ")
  }

  let alias = opts.alias;
  if (moduleAlias) {
    if (alias === undefined) {
      alias = await Console.ask("Which alias do you want to set?", "@/");
      console.log(" ")
    }
    alias = normalizeAliasPrefix(alias);
  } else {
    // keep a stable value even when disabled
    alias = "@/";
  }

  let install = opts.install;
  if (install === undefined) {
    install = await Console.confirm("Do you want to install dependencies?", true);
    console.log("             ")
  }


  return {
    appName,
    tailwind,
    examples,
    install,
    moduleAlias,
    alias,
    pathRouter,
    typeScript: typescript
  };
}
