// Theme preference: "system" (no attribute, follows the OS) | "light" | "dark", stored per device.
// The old brand-named themes are migrated: antigravity was the only dark one, the rest become "system".
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "bugreport-theme";

export function normalizeTheme(stored: string | null | undefined): ThemeChoice {
  if (stored === "light" || stored === "dark") return stored;
  if (stored === "antigravity") return "dark";
  return "system";
}

export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement) {
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

// Runs in <head> before first paint so the page never flashes in the wrong theme.
// Kept in sync with normalizeTheme by theme.test.ts.
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(v==="antigravity")v="dark";if(v==="light"||v==="dark")document.documentElement.setAttribute("data-theme",v);}catch(e){}})();`;
