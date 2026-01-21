#! /usr/bin/env node
import Console from "vatts/console";
import { createAppFromArgv } from "./createApp";

async function main() {
  try {
    await createAppFromArgv(process.argv);
  } catch (error) {
    Console.error("An error occurred:", error);
    process.exit(1);
  }
}

main();

