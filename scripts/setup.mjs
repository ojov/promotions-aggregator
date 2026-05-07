import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envPath = new URL("../.env", import.meta.url);
const envExamplePath = new URL("../.env.example", import.meta.url);

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
}

run("npx", ["playwright", "install", "chromium"]);
run("docker", ["compose", "up", "-d", "postgres"]);
run("npm", ["run", "db:migrate"]);
run("npm", ["run", "scrape"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
