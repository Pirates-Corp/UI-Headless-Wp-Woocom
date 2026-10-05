"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/defaultbutton";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  // Dark mode is temporarily disabled for this client (Light Mode only).
  // Return null to hide the theme toggle UI while preserving the
  // existing component implementation and icon bindings for future reactivation.
  const isDarkModeEnabled = false;
  if (!isDarkModeEnabled) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
