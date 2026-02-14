/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 itsmuzin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import Console from "vatts/console";
import * as path from "node:path";
import { writeFile } from "../fs";
import { CreateAppContext } from "../types";
import {backendExampleRouteTemplate, vueExampleRoute, webIndexRouteTemplate} from "../templates";

export async function createExampleRoutes(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating example routes...");

  if(ctx.framework === 'react') {
    let pathResolve = path.join(ctx.rootDir, "src", "web", `page.${ctx.typeScript ? 'tsx' : 'jsx'}`)
    writeFile(pathResolve, webIndexRouteTemplate(ctx.willTailwind, ctx.typeScript));
  } else if(ctx.framework === 'vue') {
    let pathResolve = path.join(ctx.rootDir, "src", "web", `page.vue`)
    writeFile(pathResolve, vueExampleRoute(ctx.typeScript, ctx.willTailwind));
  }
  writeFile(path.join(ctx.rootDir, "src", "backend", "routes", `Example.${ctx.typeScript ? 'ts' : 'js'}`), backendExampleRouteTemplate(ctx.typeScript));

  dynamic.end("Example routes created.");
}
