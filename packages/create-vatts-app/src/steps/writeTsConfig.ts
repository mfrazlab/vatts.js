import Console from "vatts/console";
import * as path from "node:path";
import { writeFile } from "../fs";
import { CreateAppContext } from "../types";
import { tsconfigTemplate } from "../templates";

export async function writeTsConfig(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Initializing TypeScript configuration...");
  writeFile(
    path.join(ctx.rootDir, "tsconfig.json"),
    tsconfigTemplate(ctx.willUseModuleAlias ? { moduleAlias: ctx.moduleAlias } : { moduleAlias: false }),
  );
  dynamic.end("TypeScript configuration initialized.");
}
