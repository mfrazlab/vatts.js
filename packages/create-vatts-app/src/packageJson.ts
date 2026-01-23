import type { CreateAppContext } from "./types";
import Console from "vatts/console";

export async function buildPackageJson(ctx: Pick<CreateAppContext, "appName" | "vattsVersion" | "willTailwind" | "typeScript">) {
  async function verifyVersion(): Promise<string> {
    // node fetch
    try {
      const response = await fetch('https://registry.npmjs.org/vatts/latest');
      const data = await response.json();
      return data.version;
    } catch (error) {
      Console.error('Could not check for the latest Vatts.js version:', error);
      return ctx.vattsVersion; // Retorna a versão atual em caso de erro
    }
  }
  const version = await verifyVersion();
  const packageJson: any = {
    name: ctx.appName,
    version: "0.1.0",
    description: "Basic application for Vatts.js framework",
    scripts: {
      start: "vatts start",
      dev: "vatts dev",
    },
    dependencies: {
      vatts: `${version}`,
      react: "^19.2.3",
      "react-dom": "^19.2.3"
    },
    devDependencies: {
      "@types/react": "^19.2.8",
    },
  };

  if(ctx.typeScript) {
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      typescript: "^5.9.3",
    }
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "ts-node": "^10.9.2",
    }
  }

  if (ctx.willTailwind) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      tailwindcss: "^4.1.18",
      "@tailwindcss/postcss": "^4.1.18",
      postcss: "^8.5.6",
      autoprefixer: "^10.4.23",
    };
  }

  return packageJson;
}
