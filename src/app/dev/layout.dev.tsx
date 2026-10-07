import { notFound } from "next/navigation";
import DevFetchStub from "./_DevFetchStub";

// Dev-only style guide. Production builds don't include this route at all
// (next.config pageExtensions); this check is a second line of defence.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <DevFetchStub />
      {children}
    </>
  );
}
