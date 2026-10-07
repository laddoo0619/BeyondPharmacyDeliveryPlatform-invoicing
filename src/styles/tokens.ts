// TypeScript mirror of the colour tokens in src/styles/theme.css, for places
// CSS custom properties can't reach: the invoice PDF (jsPDF takes RGB tuples)
// and the global error screen (it replaces the root layout, so it styles
// itself inline). src/styles/__tests__/tokens.test.ts keeps the two in sync
// and checks every text/background pairing for contrast.

export const colors = {
  navy: "#21387c",
  navyDeep: "#15234e",
  ink: "#33447a",
  muted: "#5d6a92",
  green: "#85c043",
  greenLink: "#557f2a",
  cream: "#faf1e3",
  panelCream: "#f6f1e8",
  danger: "#b3261e",
  white: "#ffffff",
  blush: "#fbe5e5",
  blue: "#dee8f7",
  mint: "#e3f1e6",
  butter: "#fff3c8",
  lilac: "#ece3f2",
  blushHover: "#f6d8d7",
} as const;

export type ColorToken = keyof typeof colors;

export const radii = {
  pill: "999px",
} as const;

export const fontStacks = {
  sans: "var(--font-dm-sans), system-ui, sans-serif",
} as const;

/** A token as an [r, g, b] tuple (jsPDF's colour format). */
export function rgbTuple(token: ColorToken): [number, number, number] {
  const hex = colors[token];
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}
