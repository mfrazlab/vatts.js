import Console from "vatts/console";
import * as path from "node:path";
import { writeFile } from "../fs";
import { CreateAppContext } from "../types";
import { backendExampleRouteTemplate, webIndexRouteTemplate } from "../templates";

export async function createExampleRoutes(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating example routes...");

  let pathResolve = path.join(ctx.rootDir, "src", "web", "routes", `index.${ctx.typeScript ? 'tsx' : '.jsx'}`)
  if(ctx.pathRouter) {
    pathResolve = path.join(ctx.rootDir, "src", "web", `page.${ctx.typeScript ? 'tsx' : '.jsx'}`)
  }
  writeFile(pathResolve, webIndexRouteTemplate(ctx.willTailwind, ctx.pathRouter, ctx.typeScript));

  writeFile(path.join(ctx.rootDir, "src", "backend", "routes", `Example.${ctx.typeScript ? 'ts' : '.js'}`), backendExampleRouteTemplate(ctx.typeScript));

  dynamic.end("Example routes created.");
}
