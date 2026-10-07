import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { colors, rgbTuple, type ColorToken } from "@/styles/tokens";

const themeCss = readFileSync(fileURLToPath(new URL("../theme.css", import.meta.url)), "utf8");

function cssVar(name: string) {
  const match = themeCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim();
}

const kebab = (token: string) => token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function luminance(token: ColorToken) {
  const [r, g, b] = rgbTuple(token).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: ColorToken, b: ColorToken) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("tokens.ts mirrors theme.css", () => {
  for (const [token, hex] of Object.entries(colors)) {
    it(`--${kebab(token)} matches`, () => {
      expect(cssVar(kebab(token))).toBe(hex);
      expect(cssVar(`${kebab(token)}-rgb`)).toBe(rgbTuple(token as ColorToken).join(" "));
    });
  }
});

// Every text colour / surface pairing the design system uses. Muted text never
// sits on the blush, blue or lilac pastels, and green link text only on white —
// those pairings fall under 4.5:1, so components don't use them.
const TEXT_ON_SURFACE: Array<[ColorToken, ColorToken[]]> = [
  ["navy", ["white", "cream", "panelCream", "blush", "blue", "mint", "butter", "lilac"]],
  ["navyDeep", ["white", "cream", "panelCream", "blush", "blue", "mint", "butter", "lilac"]],
  ["ink", ["white", "cream", "panelCream", "blush", "blue", "mint", "butter", "lilac"]],
  ["muted", ["white", "cream", "panelCream", "mint", "butter"]],
  ["danger", ["white", "cream", "panelCream", "blush", "blushHover"]],
  ["greenLink", ["white"]],
  ["cream", ["navy", "navyDeep"]],
  ["white", ["navy", "navyDeep"]],
];

describe("text contrast is at least 4.5:1 (WCAG AA)", () => {
  for (const [text, surfaces] of TEXT_ON_SURFACE) {
    for (const surface of surfaces) {
      it(`${text} on ${surface}`, () => {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
