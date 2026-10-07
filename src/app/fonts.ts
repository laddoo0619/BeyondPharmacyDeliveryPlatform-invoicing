import { DM_Sans, DM_Serif_Display } from "next/font/google";

// Self-hosted at build time by next/font, so the CSP (font-src 'self') holds.
// Shared by the root layout and the global error screen (which replaces the
// root layout, so it has to load the font itself).
export const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-dm-serif",
});
