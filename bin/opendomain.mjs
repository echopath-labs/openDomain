#!/usr/bin/env node

import { runCli } from "../src/cli.mjs";

runCli(process.argv.slice(2)).then((exitCode) => {
  if (typeof exitCode === "number") {
    process.exitCode = exitCode;
  }
}).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
