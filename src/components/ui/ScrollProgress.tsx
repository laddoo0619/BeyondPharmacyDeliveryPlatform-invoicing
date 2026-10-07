"use client";

import { useEffect, useState } from "react";

// Fixed 3px reading-progress bar at the very top; hidden when nothing scrolls.
export default function ScrollProgress() {
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollable = root.scrollHeight - root.clientHeight;
      setProgress(scrollable > 1 ? Math.min(1, Math.max(0, root.scrollTop / scrollable)) : null);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Content that grows after load (polling lists, expanding rows).
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resize.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (progress === null) return null;

  return (
    <div className="scroll-progress" aria-hidden="true">
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
