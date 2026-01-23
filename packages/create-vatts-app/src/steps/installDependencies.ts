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
