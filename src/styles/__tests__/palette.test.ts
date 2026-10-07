import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The reskin's leftover check: outside src/styles (the one theme file and its
// TypeScript mirror), no component may carry its own colours — no old palette
// utilities, gradients, arbitrary shadows, hex codes or rgb() values — nor
// one-off type sizes, tracking, leading, strokes, radii or durations.

const srcDir = fileURLToPath(new URL("../../", import.meta.url));
const stylesDir = path.join(srcDir, "styles");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (full === stylesDir) return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) && full !== path.join(srcDir, "app/globals.css") ? [full] : [];
  });
}

const RULES: Array<[string, RegExp]> = [
  [
    "old palette utility",
    /\b(?:bg|text|border|ring|from|via|to|divide|outline|shadow|fill|stroke|accent|placeholder|decoration|caret)-(?:slate|gray|zinc|neutral|stone|rose|red|emerald|green|teal|sky|blue|indigo|violet|purple|amber|yellow|orange|lime|cyan|pink|fuchsia)-\d{2,3}\b/,
  ],
  ["background gradient utility", /\bbg-(?:linear|gradient|radial|conic)-to?-?[a-z]+\b/],
  ["black or white text/fill", /\b(?:text-white|text-black|bg-black)\b/],
  ["arbitrary shadow", /\bshadow-\[/],
  ["hex colour", /(?<!&)#[0-9a-fA-F]{3,8}\b/],
  ["rgb()/rgba() colour", /\brgba?\(/],
  [
    "one-off type, stroke or motion value (use the theme tokens)",
    /\b(?:duration|text|tracking|leading|scale|backdrop-blur|backdrop-saturate|rounded)-\[|\bborder-\[\d/,
  ],
];

describe("no colours outside the theme", () => {
  const files = sourceFiles(srcDir);

  it("scans the app source", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const [name, pattern] of RULES) {
    it(`has no ${name}`, () => {
      const hits = files.flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((line, i) => (pattern.test(line) ? `${path.relative(srcDir, file)}:${i + 1}: ${line.trim()}` : null))
          .filter((hit): hit is string => hit !== null)
      );
      expect(hits).toEqual([]);
    });
  }
});
