import Link from "next/link";
import DevFrame from "./_DevFrame";
import { SCREENS } from "./_screens";

// Index of everything the style guide can render.
export default function DevIndex() {
  return (
    <DevFrame>
      <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
        <h1>Style guide (dev only)</h1>
        <p>Fixture data only — no database, no sign-in. Not part of production builds.</p>
        <ul>
          <li><Link href="/dev/style-guide">Primitives</Link></li>
          <li><Link href="/login">Sign-in screen (real route)</Link></li>
          {SCREENS.map((s) => (
            <li key={s.path}>
              <Link href={`/dev/${s.path}`}>{s.label}</Link>
            </li>
          ))}
        </ul>
      </main>
    </DevFrame>
  );
}
