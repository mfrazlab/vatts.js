import Console from "vatts/console";
import * as path from "node:path";
import { writeFile } from "../fs";
import { CreateAppContext } from "../types";
import { postcssConfigTemplate, tailwindConfigTemplate } from "../templates";

export async function setupTailwind(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Setting up Tailwind CSS...");
  writeFile(path.join(ctx.rootDir, "postcss.config.js"), postcssConfigTemplate());
  writeFile(path.join(ctx.rootDir, "tailwind.config.js"), tailwindConfigTemplate());
  dynamic.end("Tailwind CSS setup complete.");
}
