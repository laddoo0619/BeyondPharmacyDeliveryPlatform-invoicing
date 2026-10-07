import { cn } from "@/lib/portalStyles";

// Decorative pastel circles (design system §5). Empty, aria-hidden,
// pointer-events: none. The host is `circle-host` (relative, z-0: panels and
// full-screen pages with their own background) or `circle-anchor` (page
// headers inside the isolated portal shell) — see theme.css. Either way the
// circles sit behind content and never cover anything interactive.
// Use only on page headers, sign-in/landing screens and coloured panels —
// never behind tables, calendars, grids or forms.

const VARIANTS = {
  // Hero (sign-in, store picker): blush top-left + mint bottom-right.
  hero: ["circle--blush circle--hero-tl", "circle--mint circle--hero-br"],
  // Page header row: blush top-left + mint top-right.
  pageHeader: ["circle--blush circle--hero-tl", "circle--mint circle--header-tr"],
  // Alternates for following sections, so colours vary down the page.
  section2: ["circle--blue circle--s2-tl"],
  section3: ["circle--blush circle--s3-tr"],
  section4: ["circle--butter circle--s4-bl"],
  section5: ["circle--lilac circle--s5-tl"],
  // Inside a mint panel: a butter circle off the top-right corner.
  mintPanel: ["circle--butter circle--panel-tr"],
  // Inside a cream call-to-action panel.
  creamPanel: ["circle--mint circle--cta-tr", "circle--butter circle--cta-br"],
} as const;

export type CircleVariant = keyof typeof VARIANTS;

export default function Circles({ variant }: { variant: CircleVariant }) {
  return (
    <>
      {VARIANTS[variant].map((classes) => (
        <div key={classes} aria-hidden="true" className={cn("circle", classes)} />
      ))}
    </>
  );
}
