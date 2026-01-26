import Console from "vatts/console";
import * as path from "node:path";
import { writeFile } from "../fs";
import { CreateAppContext } from "../types";
import {backendExampleRouteTemplate, vueExampleRoute, webIndexRouteTemplate} from "../templates";

export async function createExampleRoutes(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating example routes...");

  if(ctx.framework === 'react') {
    let pathResolve = path.join(ctx.rootDir, "src", "web", "routes", `index.${ctx.typeScript ? 'tsx' : 'jsx'}`)
    if(ctx.pathRouter) {
      pathResolve = path.join(ctx.rootDir, "src", "web", `page.${ctx.typeScript ? 'tsx' : 'jsx'}`)
    }
    writeFile(pathResolve, webIndexRouteTemplate(ctx.willTailwind, ctx.pathRouter, ctx.typeScript));
  } else if(ctx.framework === 'vue') {
    let pathResolve = path.join(ctx.rootDir, "src", "web", "routes", `index.vue`)
    if(ctx.pathRouter) {
      pathResolve = path.join(ctx.rootDir, "src", "web", `page.vue`)
    }
    writeFile(pathResolve, vueExampleRoute(ctx.typeScript, ctx.pathRouter, ctx.willTailwind));
  }
  writeFile(path.join(ctx.rootDir, "src", "backend", "routes", `Example.${ctx.typeScript ? 'ts' : 'js'}`), backendExampleRouteTemplate(ctx.typeScript));

  dynamic.end("Example routes created.");
}
