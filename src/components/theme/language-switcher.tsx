"use client";

import { useRouter } from "next/navigation";
import { useAppTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";

const UI_LANGUAGES = [
  ["en", "English"],
  ["ja", "日本語"],
  ["zh-CN", "简体中文"],
  ["ko", "한국어"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["pt-BR", "Português (Brasil)"],
  ["ru", "Русский"],
] as const;

export function LanguageSwitcher() {
  const router = useRouter();
  const { i18n, t } = useAppTranslation();
  const [mounted, setMounted] = useState(false);
  
  // Set mounted to true on client-side
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const changeLanguage = (locale: string) => {
    void i18n.changeLanguage(locale);
    router.refresh();
  };
  
  const selectedLanguage = UI_LANGUAGES.some(([code]) => code === i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : "en";

  return (
    <select
      aria-label={mounted ? t("settings.appLanguage") : "App language"}
      value={mounted ? selectedLanguage : "en"}
      onChange={(event) => changeLanguage(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
    >
      {UI_LANGUAGES.map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  );
}
