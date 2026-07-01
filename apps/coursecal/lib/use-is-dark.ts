import { useSyncExternalStore } from "react";

// Reads the active theme from the `.dark` class on <html> that the no-FOUC script
// (root layout) and the theme toggle manage. A MutationObserver keeps it in sync.
// getServerSnapshot returns false so SSR and the first client render agree (no
// hydration mismatch); the real value applies after hydration.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

export function useIsDark() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
