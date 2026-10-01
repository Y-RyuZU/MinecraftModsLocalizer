"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppTranslation } from "@/lib/i18n";
import type { TranslationTarget } from "@/lib/types/minecraft";
import { isRetranslationRequested, normalizeLanguageId } from "@/lib/services/translation-policy";

export function RetranslationControl({ target, targetLanguage, updateTarget, disabled, hasExistingTranslation }: {
  target: TranslationTarget;
  targetLanguage: string;
  updateTarget: (changes: Partial<TranslationTarget>) => void;
  disabled: boolean;
  hasExistingTranslation: (target: TranslationTarget, language: string) => boolean | Promise<boolean>;
}) {
  const { t } = useAppTranslation();
  const language = normalizeLanguageId(targetLanguage);
  const [existing, setExisting] = useState<{ target: TranslationTarget; language: string }>();
  useEffect(() => {
    let active = true;
    setExisting(undefined);
    if (language) {
      Promise.resolve().then(() => hasExistingTranslation(target, language))
        .then(exists => { if (active && exists) setExisting({ target, language }); })
        .catch(error => console.error("Failed to check existing translation", error));
    }
    return () => { active = false; };
  }, [target, language, disabled, hasExistingTranslation]);
  if (!language || existing?.target !== target || existing.language !== language) return null;
  const checked = isRetranslationRequested(target, language);
  return <div className="flex items-center gap-2">
    {!checked && <span className="text-xs text-muted-foreground">{t("tables.existingTranslationSkipped", { language })}</span>}
    <label className="flex items-center gap-1.5 whitespace-nowrap">
      <Checkbox checked={checked} onCheckedChange={value => updateTarget({ forceTranslationLanguage: value ? language : undefined })} disabled={disabled} />
      <span className="text-xs">{t("tables.translateAnyway")}</span>
    </label>
  </div>;
}
