// Builds the Expo web bundle from ../mobile and drops it into ./public so the
// Next.js server hosts the web app at "/" alongside the API (/api) and share
// pages (/s). Also wires up PWA "Add to Home Screen" support. Run automatically
// by the "vercel-build" script before next build.
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // server/scripts
const serverDir = join(here, "..");                   // server
const mobileDir = join(serverDir, "..", "mobile");    // mobile
const distDir = join(mobileDir, "dist");
const publicDir = join(serverDir, "public");
const pwaDir = join(serverDir, "pwa");

const run = (cmd, cwd) =>
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    // Give Metro plenty of heap on constrained CI containers.
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=4096`.trim() },
  });

// Mobile keeps its own node_modules (no workspace hoisting). Install only if
// missing (i.e. on CI / Vercel); skip when already installed locally.
if (!existsSync(join(mobileDir, "node_modules"))) {
  console.log("[build-web] installing mobile deps…");
  // `npm install --omit=dev` (not `npm ci`): the web export only needs runtime
  // deps — no typescript/@types/eas-cli — and install won't hard-fail on a
  // dev-only lockfile drift the way strict `npm ci` does.
  run("npm install --omit=dev --no-audit --no-fund", mobileDir);
}

console.log("[build-web] exporting Expo web bundle…");
run("npx expo export -p web --output-dir dist", mobileDir);

console.log("[build-web] copying bundle → server/public …");
rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(distDir, publicDir, { recursive: true });

// --- PWA: manifest + icons + head tags (Add to Home Screen) ----------------
console.log("[build-web] adding PWA manifest, icons, and head tags…");
cpSync(pwaDir, publicDir, { recursive: true });

const PWA_HEAD = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#EA580C" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Spwit" />
    <meta property="og:title" content="Spwit — split the tab, settle up" />
    <meta property="og:description" content="Snap a receipt, tap who had what, done." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://spwit.app/" />
    <meta property="og:image" content="https://spwit.app/opengraph-image" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://spwit.app/opengraph-image" />
  `;

const indexPath = join(publicDir, "index.html");
let html = readFileSync(indexPath, "utf8");
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", `${PWA_HEAD}</head>`);
  writeFileSync(indexPath, html);
}

console.log("[build-web] done.");
