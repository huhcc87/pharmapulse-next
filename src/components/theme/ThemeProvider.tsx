"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemPreference = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // Resolve theme (system -> actual preference)
  const resolveTheme = useCallback(
    (t: Theme): "light" | "dark" => {
      if (t === "system") {
        return getSystemPreference();
      }
      return t;
    },
    [getSystemPreference]
  );

  // Apply theme to document
  const applyTheme = useCallback(
    (t: Theme) => {
      if (typeof window === "undefined") return;
      
      const resolved = resolveTheme(t);
      const root = window.document.documentElement;

      if (resolved === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      setResolvedTheme(resolved);
    },
    [resolveTheme]
  );

  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const stored = localStorage.getItem("theme") as Theme | null;
    const initialTheme: Theme = stored || "system";
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, [applyTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme, applyTheme]);

  // Set theme and persist
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      if (typeof window !== "undefined") {
        localStorage.setItem("theme", newTheme);
      }
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  // Always provide context, even when not mounted (to prevent useTheme errors)
  // Use default values during SSR/unmounted state
  const contextValue = mounted 
    ? { theme, setTheme, resolvedTheme }
    : { 
        theme: "system" as Theme, 
        setTheme: () => {}, // No-op during SSR
        resolvedTheme: "light" as const 
      };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
