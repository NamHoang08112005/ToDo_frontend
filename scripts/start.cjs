const { spawnSync } = require("node:child_process");
const windows = process.platform === "win32";
const launcher = windows && spawnSync("py", ["-3", "--version"]).status === 0;
const command = launcher ? "py" : windows ? "python" : "python3";
const result = spawnSync(
  command,
  [...(launcher ? ["-3"] : []), "server.py", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
if (result.error)
  console.error("Cần Python 3.10 trở lên để chạy Motion Atlas.");
process.exit(result.status ?? 1);
