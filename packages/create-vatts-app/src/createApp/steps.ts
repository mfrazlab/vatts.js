import Console, { Colors } from "vatts/console";
import * as path from "node:path";
import { ensureDir, writeFile, writeJson } from "./fs";
import type { CreateAppContext } from "./types";
import {
  backendExampleRouteTemplate,
  globalsCssTemplate,
  layoutTsxTemplate,
  vattsConfigTemplate,
  postcssConfigTemplate,
  tailwindConfigTemplate,
  tsconfigTemplate,
  webIndexRouteTemplate,
} from "./templates";
import { buildPackageJson } from "./packageJson";
import { npmInstall } from "./install";

export async function stepCreateProjectDirAndPackageJson(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating your Vatts.js app...");

  ensureDir(ctx.rootDir);

  ctx.packageJson = await buildPackageJson({
    appName: ctx.appName,
    vattsVersion: ctx.vattsVersion,
    willTailwind: ctx.willTailwind,
  });

  writeJson(path.join(ctx.rootDir, "package.json"), ctx.packageJson);

  dynamic.end("Created project directory and package.json");
}

export async function stepCreateProjectStructure(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Creating project structure...");

  ensureDir(path.join(ctx.rootDir, "src", "backend", "routes"));
  ensureDir(path.join(ctx.rootDir, "src", "web", "routes"));

  writeFile(path.join(ctx.rootDir, "src", "web", "globals.css"), globalsCssTemplate(ctx.willTailwind));
  writeFile(path.join(ctx.rootDir, "src", "web", "layout.tsx"), layoutTsxTemplate());

  dynamic.end("Created project structure");
}

export async function stepWriteVattsConfig(ctx: CreateAppContext) {
  writeFile(path.join(ctx.rootDir, "vatts.config.ts"), vattsConfigTemplate());
}

export async function stepWriteTsConfig(ctx: CreateAppContext) {
  const dynamic = Console.dynamicLine("Initializing TypeScript configuration...");
  writeFile(
    path.join(ctx.rootDir, "tsconfig.json"),
    tsconfigTemplate(ctx.willUseModuleAlias ? { moduleAlias: ctx.moduleAlias } : { moduleAlias: false }),
  );
  dynamic.end("TypeScript configuration initialized.");
}

export async function stepSetupTailwind(ctx: CreateAppContext) {
  if (!ctx.willTailwind) return;

  const dynamic = Console.dynamicLine("Setting up Tailwind CSS...");
  writeFile(path.join(ctx.rootDir, "postcss.config.js"), postcssConfigTemplate());
  writeFile(path.join(ctx.rootDir, "tailwind.config.js"), tailwindConfigTemplate());
  dynamic.end("Tailwind CSS setup complete.");
}

export async function stepCreateExampleRoutes(ctx: CreateAppContext) {
  if (!ctx.willRouteExample) return;

  const dynamic = Console.dynamicLine("Creating example routes...");
  writeFile(path.join(ctx.rootDir, "src", "web", "routes", "index.tsx"), webIndexRouteTemplate(ctx.willTailwind));
  writeFile(path.join(ctx.rootDir, "src", "backend", "routes", "Example.ts"), backendExampleRouteTemplate());
  dynamic.end("Example routes created.");
}

export async function stepInstallDependencies(ctx: CreateAppContext) {
  if (!ctx.willInstallDependencies) return;

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

export function printSummary(ctx: CreateAppContext) {
  console.clear();

  const now = new Date();
  const time = now.toLocaleTimeString("pt-BR", { hour12: false });

  const timer = ` ${Colors.FgGray}${time}${Colors.Reset}  `;
  const label = Colors.FgGray;
  const cmd = Colors.Bright + Colors.FgCyan;
  const ok = Colors.FgGreen;

  const dim = Colors.Dim;
  const bright = Colors.Bright;

  const nodeVersion = process.version;
  const platform = process.platform;

  console.log("");
  console.log(`${timer}${bright}${Colors.FgCyan}Vatts.js${Colors.Reset} ${dim}v${ctx.vattsVersion}${Colors.Reset}`);
  console.log(`${timer}${dim}────────────────────────────────────────${Colors.Reset}`);

  console.log(`${timer}${ok}✔${Colors.Reset}  ${bright}Project ${Colors.FgWhite}${ctx.appName}${Colors.Reset}${bright} created successfully.${Colors.Reset}`);

  console.log("");
  console.log(`${timer}${label}Environment:${Colors.Reset}`);
  console.log(`${timer}${label}  • Runtime:${Colors.Reset} ${Colors.Bright + Colors.FgGreen}Node.js${Colors.Reset} ${dim}${nodeVersion}${Colors.Reset}`);
  console.log(`${timer}${label}  • Platform:${Colors.Reset} ${cmd}${platform}${Colors.Reset}`);
  console.log(`${timer}${label}  • Framework:${Colors.Reset} ${cmd}Vatts.js${Colors.Reset} ${dim}v${ctx.vattsVersion}${Colors.Reset}`);

  console.log("");
  console.log(`${timer}${label}Next steps:${Colors.Reset}`);
  console.log(`${timer}${label}  1.${Colors.Reset} ${cmd}cd ${ctx.appName}${Colors.Reset}`);

  let step = 2;
  if (!ctx.willInstallDependencies) {
    console.log(`${timer}${label}  ${step++}.${Colors.Reset} ${cmd}npm install${Colors.Reset}`);
  }

  console.log(`${timer}${label}  ${step++}.${Colors.Reset} ${cmd}vatts dev${Colors.Reset}${Colors.Reset}`);
  console.log(`${timer}${label}     or${Colors.Reset}`);
  console.log(`${timer}${label}     ${cmd}npm run dev${Colors.Reset}`);

  console.log("");
  console.log(`${timer}${label}Production:${Colors.Reset}`);
  console.log(`${timer}${label}  • Start:${Colors.Reset} ${cmd}vatts start${Colors.Reset}`);
  console.log(`${timer}${label}    or${Colors.Reset}`);
  console.log(`${timer}${label}    ${cmd}npm run start${Colors.Reset}`);

  console.log("");
  console.log(`${timer}${dim}Website:${Colors.Reset} ${Colors.FgCyan}https://vatts.mfraz.ovh${Colors.Reset}`);
  console.log("");
  console.log();
}
