#!/usr/bin/env node
// Screenshots of the dev-only style guide (src/app/dev) at phone and desktop
// widths, for before/after visual comparison. Fixture data only — no sign-in,
// no database.
//
//   TZ=America/Vancouver AUTH_SECRET=dev-only npx next dev -p 3100   (separately)
//   node scripts/screenshots.mjs <outDir> [baseUrl]
//
// Uses the project's Playwright if installed, else the machine-wide one.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      // try the next location
    }
  }
  throw new Error("Playwright not found — install it or set NODE_PATH.");
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// One source of truth for the screen list: src/app/dev/_screens.ts.
const screens = [...readFileSync(path.join(root, "src/app/dev/_screens.ts"), "utf8").matchAll(/path: "([^"]+)"/g)].map(
  (m) => `/dev/${m[1]}`
);
const ROUTES = ["/dev/style-guide", "/login", ...screens];
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];
// 11:00 Vancouver on the real Vancouver day — the same day the fixtures are
// built around on the server, so server and browser agree on "today" — and
// late enough for the 10 AM reminder popup screen.
function vancouverTodayAt(hour) {
  const now = new Date();
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName").value; // e.g. "GMT-7"
  const [, sign, hours] = offset.match(/GMT([+-])(\d+)/);
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00${sign}${hours.padStart(2, "0")}:00`);
}
const FIXED_TIME = vancouverTodayAt(11);

const outDir = path.resolve(process.argv[2] ?? "screenshots");
const base = process.argv[3] ?? "http://localhost:3100";
mkdirSync(outDir, { recursive: true });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const failures = [];
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      timezoneId: "America/Vancouver",
      locale: "en-US",
    });
    for (const route of ROUTES) {
      const page = await context.newPage();
      await page.clock.setFixedTime(FIXED_TIME);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(base + route, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.evaluate(() => document.fonts.ready);
      // Let entrance animations finish (they are ~2s at most).
      await page.waitForTimeout(2500);
      const file = path.join(outDir, `${route.replace(/^\//, "").replace(/\//g, "_") || "root"}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (!res || res.status() >= 400 || errors.length) {
        failures.push(`${route} @${vp.name}: status ${res?.status()} ${errors.join(" | ")}`);
      }
      console.log(`${res?.status()} ${route} @${vp.name} -> ${path.basename(file)}`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error("\nProblems:\n" + failures.join("\n"));
  process.exit(1);
}
