const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function startProcess(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: isWindows,
    stdio: "pipe",
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    process.stdout.write(`[${name}] exited with ${reason}\n`);
  });

  return child;
}

const server = startProcess("server", "node", ["server.js"], path.join(rootDir, "server"));
const clientCommand = isWindows ? "npm.cmd" : "npm";
const client = startProcess("client", clientCommand, ["run", "dev"], path.join(rootDir, "client"));

const children = [server, client];
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stdout.write(`\nStopping local dev processes (${signal})...\n`);
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.stdout.write("Starting local dev environment...\n");
process.stdout.write("Frontend: http://localhost:5173\n");
process.stdout.write("Backend:  http://localhost:3000\n");
process.stdout.write("Health:   http://localhost:3000/api/health\n\n");

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
