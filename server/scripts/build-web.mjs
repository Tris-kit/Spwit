// Builds the Expo web bundle from ../mobile and drops it into ./public so the
// Next.js server hosts the web app at "/" alongside the API (/api) and share
// pages (/s). Run automatically by the "vercel-build" script before next build.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // server/scripts
const serverDir = join(here, "..");                   // server
const mobileDir = join(serverDir, "..", "mobile");    // mobile
const distDir = join(mobileDir, "dist");
const publicDir = join(serverDir, "public");

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

// Mobile keeps its own node_modules (no workspace hoisting). Install only if
// missing (i.e. on CI / Vercel); skip when already installed locally.
if (!existsSync(join(mobileDir, "node_modules"))) {
  console.log("[build-web] installing mobile deps…");
  run("npm ci", mobileDir);
}

console.log("[build-web] exporting Expo web bundle…");
run("npx expo export -p web --output-dir dist", mobileDir);

console.log("[build-web] copying bundle → server/public …");
rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(distDir, publicDir, { recursive: true });

console.log("[build-web] done.");
