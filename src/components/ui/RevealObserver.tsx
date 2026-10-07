"use client";

import { useEffect } from "react";

// Scroll reveal for elements marked `data-reveal` (design system §8). Markup
// is visible as rendered — without JavaScript nothing is ever hidden. Once
// mounted, this marks only elements still below the fold as "pending" and
// reveals each as it scrolls into view. If the observer hasn't reported
// within ~900ms, everything is revealed anyway: content never stays hidden.

const FALLBACK_MS = 900;

export default function RevealObserver() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let observerReported = false;
    const reveal = (el: Element) => el.setAttribute("data-reveal", "shown");

    const observer = new IntersectionObserver(
      (entries) => {
        observerReported = true;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );

    const fallbacks = new Set<number>();
    const track = (root: ParentNode) => {
      const pending: Element[] = [];
      root.querySelectorAll('[data-reveal=""], [data-reveal="true"]').forEach((el) => {
        // Already on screen: leave it as rendered (no flash, no animation).
        if (el.getBoundingClientRect().top < window.innerHeight) {
          reveal(el);
          return;
        }
        el.setAttribute("data-reveal", "pending");
        observer.observe(el);
        pending.push(el);
      });
      if (pending.length === 0) return;
      const timer = window.setTimeout(() => {
        fallbacks.delete(timer);
        if (!observerReported) pending.forEach(reveal);
      }, FALLBACK_MS);
      fallbacks.add(timer);
    };

    track(document);
    // Client-side navigation brings in new screens without a reload.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches('[data-reveal=""], [data-reveal="true"]')) track(node.parentElement ?? document);
            else track(node);
          }
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      fallbacks.forEach((timer) => window.clearTimeout(timer));
      document.querySelectorAll('[data-reveal="pending"]').forEach(reveal);
    };
  }, []);

  return null;
}
