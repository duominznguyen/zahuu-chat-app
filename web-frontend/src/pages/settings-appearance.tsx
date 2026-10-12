import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Sáng", icon: <Sun className="size-5" /> },
  { value: "dark", label: "Tối", icon: <Moon className="size-5" /> },
  { value: "system", label: "Theo hệ thống", icon: <Monitor className="size-5" /> },
];

export default function SettingsAppearance() {
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference);

  const select = (value: ThemePreference) => {
    setThemePreference(value);
    setPreference(value);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Giao diện</h1>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={preference === option.value}
            onClick={() => select(option.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors",
              preference === option.value
                ? "border-primary bg-accent font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
