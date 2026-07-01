"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsDark } from "@/lib/use-is-dark";

// Hand-rolled theme switch (no next-themes dependency). The no-FOUC script in the
// root layout sets the initial `.dark` class from the cookie/OS preference before
// paint; this reads that class (useIsDark) and toggles it, persisting the choice
// in a cookie.
export function ThemeToggle() {
  const isDark = useIsDark();

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label="Toggle dark mode"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
