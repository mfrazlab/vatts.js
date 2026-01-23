import Console, { Colors } from "vatts/console";
import { CreateAppContext } from "./types";

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
