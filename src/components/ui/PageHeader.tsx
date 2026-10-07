import type { ReactNode } from "react";
import Circles from "./Circles";
import { cn } from "@/lib/portalStyles";

// A page's title row, with pastel circles floating behind it. Pass the row's
// own layout classes (flex, spacing) as `className`. Must render inside the
// portal shell (an isolated stacking context) — see .circle-anchor.
export default function PageHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("circle-anchor", className)}>
      <Circles variant="pageHeader" />
      {children}
    </div>
  );
}
