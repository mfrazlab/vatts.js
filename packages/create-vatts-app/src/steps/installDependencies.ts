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
import Console, { Colors } from "vatts/console";
import { CreateAppContext } from "../types";
import { npmInstall } from "../install";

export async function installDependencies(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Installing dependencies...");

  console.log(`\nInstalling dependencies:\n${
    ctx.packageJson.dependencies
      ? Object.keys(ctx.packageJson.dependencies)
          .map((dep: string) => `  - ${Colors.FgCyan}${dep}${Colors.Reset}`)
          .join("\n")
      : ""
  }\n\nInstalling devDependencies:\n${
    ctx.packageJson.devDependencies
      ? Object.keys(ctx.packageJson.devDependencies)
          .map((dep: string) => `  - ${Colors.FgCyan}${dep}${Colors.Reset}`)
          .join("\n")
      : ""
  }\n`);

  const spinnerFrames = ["|", "/", "-", "\\"];
  let frameIndex = 0;
  const spinner = setInterval(() => {
    dynamic.update(`${Colors.FgGreen}${spinnerFrames[frameIndex]}${Colors.Reset} Installing...`);
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
  }, 100);

  try {
    await npmInstall(ctx.rootDir);
  } finally {
    clearInterval(spinner);
  }

  dynamic.end("Dependencies installed.");
}
