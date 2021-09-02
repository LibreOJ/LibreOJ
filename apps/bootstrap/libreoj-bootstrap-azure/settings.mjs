import fs from "fs";
import child_process from "child_process";

import config from "../config.mjs";

const command = process.argv[2];
if (command === "local") {
  fs.writeFileSync(
    "local.settings.json",
    JSON.stringify({
      IsEncrypted: false,
      Values: {
        FUNCTIONS_WORKER_RUNTIME: "node",
        AzureWebJobsStorage: "",
        CONFIG: JSON.stringify(config)
      }
    })
  );
} else if (command === "deploy") {
  const commandLine = [
    ...process.argv.slice(3),
    // Adding a space after '=' to workaround https://github.com/Azure/azure-cli/issues/10215
    `CONFIG= ${JSON.stringify(config)}`
  ];

  child_process.execFileSync(commandLine[0], commandLine.slice(1), {
    shell: false,
    stdio: "inherit"
  });
} else {
  console.error(`Unknown command ${JSON.stringify(command)}. Valid commands are "local" and "deploy".`);
}
