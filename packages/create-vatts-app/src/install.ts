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
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

function trySpawn(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

export async function npmInstall(cwd: string) {
  // Strategy (Windows-safe):
  // 1) Try npm.cmd from PATH
  // 2) Fallback: run npm-cli.js with Node (process.execPath) at the same Node installation
  // 3) Try npm from PATH (non-windows / alternative)

  const args = ["install"];

  // 1) npm.cmd
  if (process.platform === "win32") {
    try {
      return await trySpawn("npm.cmd", args, cwd);
    } catch {
      // ignore and fallback
    }

    // 2) npm-cli.js via node
    // Typical location: <nodeDir>/node_modules/npm/bin/npm-cli.js
    const nodeDir = path.dirname(process.execPath);
    const npmCli = path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");
    if (fs.existsSync(npmCli)) {
      return await trySpawn(process.execPath, [npmCli, ...args], cwd);
    }
  }

  // 3) npm
  return await trySpawn("npm", args, cwd);
}
