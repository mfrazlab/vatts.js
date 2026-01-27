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
import { ensureDir, writeFile } from "../fs";
import { CreateAppContext } from "../types";
import {globalsCssTemplate, layoutJsxTemplate, layoutTsxTemplate, vueExampleLayout} from "../templates";

export async function createProjectStructure(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating project structure...");

  ensureDir(path.join(ctx.rootDir, "src", "backend", "routes"));
  if(!ctx.pathRouter) {
    ensureDir(path.join(ctx.rootDir, "src", "web", "routes"));
  } else {
    ensureDir(path.join(ctx.rootDir, "src", "web"));
  }

  writeFile(path.join(ctx.rootDir, "src", "web", "globals.css"), globalsCssTemplate(ctx.willTailwind));
  if(ctx.framework === 'react') {
    writeFile(path.join(ctx.rootDir, "src", "web", `layout.${ctx.typeScript ? 'tsx' : 'jsx'}`), ctx.typeScript? layoutTsxTemplate() : layoutJsxTemplate());
  } else if(ctx.framework === 'vue') {
    writeFile(path.join(ctx.rootDir, "src", "web", `layout.vue`), vueExampleLayout(ctx.typeScript));
  }

  dynamic.end("Created project structure");
}
