import { CreateAppContext } from "../types";
import { createProject } from "./createProject";
import { createProjectStructure } from "./createProjectStructure";
import { writeVattsConfig } from "./writeVattsConfig";
import { writeTsConfig } from "./writeTsConfig";
import { setupTailwind } from "./setupTailwind";
import { createExampleRoutes } from "./createExampleRoutes";
import { installDependencies } from "./installDependencies";

export interface Step {
  label: string;
  action: (ctx: CreateAppContext) => Promise<void>;
  condition?: (ctx: CreateAppContext) => boolean;
}

export const steps: Step[] = [
  {
    label: "Creating project directory and package.json",
    action: createProject,
  },
  {
    label: "Creating project structure",
    action: createProjectStructure,
  },
  {
    label: "Writing vatts.config.ts",
    action: writeVattsConfig,
  },
  {
    label: "Initializing TypeScript configuration",
    action: writeTsConfig,
  },
  {
    label: "Setting up Tailwind CSS",
    action: setupTailwind,
    condition: (ctx) => ctx.willTailwind,
  },
  {
    label: "Creating example routes",
    action: createExampleRoutes,
    condition: (ctx) => ctx.willRouteExample,
  },
  {
    label: "Installing dependencies",
    action: installDependencies,
    condition: (ctx) => ctx.willInstallDependencies,
  },
];
