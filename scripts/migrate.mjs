import "dotenv/config";
import { spawnSync } from "node:child_process";
const mode = process.argv[2];
if (!["deploy", "dev"].includes(mode))
  throw new Error("Expected deploy or dev.");
const result = spawnSync(
  "node",
  ["node_modules/prisma/build/index.js", "migrate", mode],
  {
    stdio: "inherit",
    env: process.env,
  },
);
process.exit(result.status ?? 1);
