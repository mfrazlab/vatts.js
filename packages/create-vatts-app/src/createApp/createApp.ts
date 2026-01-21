import type { CreateAppContext, CreateAppOptions } from "./types";
import { parseArgs, promptForMissingOptions } from "./cli";
import {
  printSummary,
  stepCreateExampleRoutes,
  stepCreateProjectDirAndPackageJson,
  stepCreateProjectStructure,
  stepInstallDependencies,
  stepSetupTailwind,
  stepWriteVattsConfig,
  stepWriteTsConfig,
} from "./steps";
import * as path from "node:path";
import { assertTargetDirIsSafeEmpty, validateAppName } from "./validate";

function resolveOwnPackageJson() {

  const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(pkgPath);
}

export async function createAppFromArgv(argv: string[]) {
  const opts = parseArgs(argv);
  return createApp(opts);
}

export async function createApp(options: CreateAppOptions) {
  const resolved = await promptForMissingOptions(options);

  const safeName = validateAppName(resolved.appName);
  const rootDir = safeName;

  // Fail fast to avoid overwriting anything.
  assertTargetDirIsSafeEmpty(rootDir);

  const ownPkg = resolveOwnPackageJson();

  const ctx: CreateAppContext = {
    appName: safeName,
    rootDir,
    willTailwind: resolved.tailwind,
    willRouteExample: resolved.examples,
    willInstallDependencies: resolved.install,

    willUseModuleAlias: resolved.moduleAlias,
    moduleAlias: resolved.alias,

    vattsVersion: ownPkg.version,
    packageJson: {},
  };

  console.clear();

  await stepCreateProjectDirAndPackageJson(ctx);
  await stepCreateProjectStructure(ctx);
  await stepWriteVattsConfig(ctx);
  await stepWriteTsConfig(ctx);
  await stepSetupTailwind(ctx);
  await stepCreateExampleRoutes(ctx);
  await stepInstallDependencies(ctx);

  printSummary(ctx);
}
