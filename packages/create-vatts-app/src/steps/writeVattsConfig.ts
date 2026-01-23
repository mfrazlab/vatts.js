import * as path from "node:path";
import { writeFile } from "../fs";
import { CreateAppContext } from "../types";
import { vattsConfigTemplate } from "../templates";

export async function writeVattsConfig(ctx: CreateAppContext) {
  writeFile(path.join(ctx.rootDir, `vatts.config.${ctx.typeScript ? 'ts' : 'js'}`), vattsConfigTemplate(ctx.typeScript, ctx.pathRouter));
}
