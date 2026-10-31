import { spawn } from "node:child_process";

const port = process.env.SMOKE_PORT ?? "3123";
const server = spawn("node_modules/.bin/next", ["start", "-p", port], {
  stdio: "inherit",
});

let code = 1;
try {
  for (let i = 0; i < 60; i++) {
    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/public/health`);
      const page = await fetch(`http://127.0.0.1:${port}/`);
      if (health.ok && page.ok) {
        console.log(`smoke ok: health ${health.status}, page ${page.status}`);
        code = 0;
        break;
      }
      console.log(`waiting: health ${health.status}, page ${page.status}`);
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
} finally {
  server.kill();
}
process.exit(code);
