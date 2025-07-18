"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";

export function LanguageSwitcher() {
  const router = useRouter();
  const { i18n } = useAppTranslation();
  const [mounted, setMounted] = useState(false);
  
  // Set mounted to true on client-side
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const changeLanguage = (locale: string) => {
    // In App Router, we need to handle locale changes differently
    // We'll use the i18n.changeLanguage method from i18next
    i18n.changeLanguage(locale);
    
    // Refresh the page to apply the language change
    router.refresh();
  };
  
  // Only render the buttons with conditional classes after client-side hydration
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">EN</Button>
        <span className="text-muted-foreground">|</span>
        <Button variant="ghost" size="sm">JP</Button>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => changeLanguage("en")}
        className={i18n.language === "en" ? "font-bold" : ""}
      >
        EN
      </Button>
      <span className="text-muted-foreground">|</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => changeLanguage("ja")}
        className={i18n.language === "ja" ? "font-bold" : ""}
      >
        JP
      </Button>
    </div>
  );
}
