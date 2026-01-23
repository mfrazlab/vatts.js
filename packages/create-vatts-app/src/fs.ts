import * as fs from "node:fs";
import * as path from "node:path";

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeFile(targetPath: string, content: string) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, content);
}

export function writeJson(targetPath: string, data: unknown) {
  writeFile(targetPath, JSON.stringify(data, null, 2));
}

export function exists(targetPath: string) {
  return fs.existsSync(targetPath);
}
