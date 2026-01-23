import * as fs from "node:fs";
import * as path from "node:path";

const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export function validateAppName(appName: string) {
  const name = appName.trim();
  if (!name) {
    throw new Error("App name cannot be empty.");
  }

  // We scaffold into a folder with this name, so keep it filesystem-safe.
  if (name.includes(path.sep) || name.includes("/") || name.includes("\\")) {
    throw new Error("App name must be a folder name, not a path.");
  }

  // Windows forbidden chars in file/dir names.
  if (/[<>:"/\\|?*]/.test(name)) {
    throw new Error("App name contains invalid filename characters.");
  }

  if (name.length > 214) {
    throw new Error("App name is too long.");
  }

  // Avoid '.' and '..'
  if (name === "." || name === "..") {
    throw new Error("App name cannot be '.' or '..'.");
  }

  // Windows device names (case-insensitive), also invalid with extensions.
  const upper = name.toUpperCase();
  const base = upper.split(".")[0];
  if (WINDOWS_RESERVED_NAMES.has(base)) {
    throw new Error(`App name '${name}' is reserved on Windows.`);
  }

  return name;
}

export function assertTargetDirIsSafeEmpty(rootDir: string) {
  // If the directory doesn't exist, it's safe.
  if (!fs.existsSync(rootDir)) return;

  const stat = fs.statSync(rootDir);
  if (!stat.isDirectory()) {
    throw new Error(`Target path '${rootDir}' already exists and isn't a directory.`);
  }

  // Must be empty to avoid overwriting user's files.
  const entries = fs.readdirSync(rootDir);
  if (entries.length > 0) {
    throw new Error(`Target directory '${rootDir}' already exists and isn't empty.`);
  }
}
