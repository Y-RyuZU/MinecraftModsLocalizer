"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppTranslation } from "@/lib/i18n";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const { t, ready } = useAppTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by not rendering translations until mounted
  const toggleText = mounted && ready ? t('settings.toggleTheme') : 'Toggle theme';
  const lightText = mounted && ready ? t('settings.light') : 'Light';
  const darkText = mounted && ready ? t('settings.dark') : 'Dark';
  const systemText = mounted && ready ? t('settings.system') : 'System';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{toggleText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {lightText}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {darkText}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          {systemText}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
