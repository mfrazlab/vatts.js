import Console from "vatts/console";
import * as path from "node:path";
import { ensureDir, writeJson } from "../fs";
import { CreateAppContext } from "../types";
import { buildPackageJson } from "../packageJson";

export async function createProject(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating your Vatts.js app...");

  ensureDir(ctx.rootDir);

  ctx.packageJson = await buildPackageJson({
    appName: ctx.appName,
    vattsVersion: ctx.vattsVersion,
    willTailwind: ctx.willTailwind,
    typeScript: ctx.typeScript,
    framework: ctx.framework
  });

  writeJson(path.join(ctx.rootDir, "package.json"), ctx.packageJson);

  dynamic.end("Created project directory and package.json");
}
