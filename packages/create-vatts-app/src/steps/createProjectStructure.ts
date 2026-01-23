import Console from "vatts/console";
import * as path from "node:path";
import { ensureDir, writeFile } from "../fs";
import { CreateAppContext } from "../types";
import {globalsCssTemplate, layoutJsxTemplate, layoutTsxTemplate} from "../templates";

export async function createProjectStructure(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating project structure...");

  ensureDir(path.join(ctx.rootDir, "src", "backend", "routes"));
  if(!ctx.pathRouter) {
    ensureDir(path.join(ctx.rootDir, "src", "web", "routes"));
  } else {
    ensureDir(path.join(ctx.rootDir, "src", "web"));
  }

  writeFile(path.join(ctx.rootDir, "src", "web", "globals.css"), globalsCssTemplate(ctx.willTailwind));
  writeFile(path.join(ctx.rootDir, "src", "web", `layout.${ctx.typeScript ? 'tsx' : 'jsx'}`), ctx.typeScript? layoutTsxTemplate() : layoutJsxTemplate());

  dynamic.end("Created project structure");
}
