"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Preference = "light" | "dark" | "system";
type Resolved = "light" | "dark";
const key = "secondskin-theme";
const query = "(prefers-color-scheme: dark)";
function read(): Preference {
  try {
    const value = localStorage.getItem(key);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch { /* Optional persistence. */ }
  return "system";
}
function apply(value: Preference): Resolved {
  const resolved = value === "system" ? (matchMedia(query).matches ? "dark" : "light") : value;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
const Context = createContext<{ preference: Preference; resolved: Resolved; setPreference: (v: Preference) => void }>({
  preference: "system", resolved: "dark", setPreference: () => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, update] = useState<Preference>("system");
  const [resolved, setResolved] = useState<Resolved>("dark");
  useEffect(() => {
    const media = matchMedia(query);
    let current = read();
    const sync = () => { update(current); setResolved(apply(current)); };
    const storage = (e: StorageEvent) => { if (e.key === key || e.key === null) { current = read(); sync(); } };
    const local = (e: Event) => { current = (e as CustomEvent<Preference>).detail; sync(); };
    sync();
    if (media.addEventListener) media.addEventListener("change", sync);
    else media.addListener(sync);
    window.addEventListener("storage", storage);
    window.addEventListener("secondskin-theme-change", local);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", sync);
      else media.removeListener(sync);
      window.removeEventListener("storage", storage);
      window.removeEventListener("secondskin-theme-change", local);
    };
  }, []);
  const setPreference = (value: Preference) => {
    update(value); setResolved(apply(value));
    try { localStorage.setItem(key, value); } catch { /* Optional persistence. */ }
    window.dispatchEvent(new CustomEvent("secondskin-theme-change", { detail: value }));
  };
  return <Context.Provider value={{ preference, resolved, setPreference }}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
export function ThemeControl({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  if (compact) {
    const Icon = preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;
    return (
      <div className={cn("relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground focus-within:ring-2 focus-within:ring-ring", className)}>
        <Icon className="size-4 pointer-events-none" aria-hidden="true" />
        <select aria-label="Color theme" title="Color theme" value={preference}
          onChange={(event) => setPreference(event.target.value as Preference)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
        </select>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Color theme" className={cn("inline-flex shrink-0 items-center rounded-full border border-border bg-muted/40 p-0.5", className)}>
      {([{ value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }, { value: "system", label: "System", Icon: Monitor }] as const).map(({ value, label, Icon }) => (
        <button key={value} type="button" aria-label={label + " theme"} title={label + " theme"} aria-pressed={preference === value}
          onClick={() => setPreference(value)}
          className={cn("inline-flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring", preference === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
