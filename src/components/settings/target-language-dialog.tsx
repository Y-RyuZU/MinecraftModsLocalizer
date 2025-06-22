"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SupportedLanguage, DEFAULT_LANGUAGES } from "@/lib/types/llm";
import { useAppTranslation } from "@/lib/i18n";
import { X } from "lucide-react";

interface TargetLanguageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  additionalLanguages: SupportedLanguage[];
  onAddLanguage: (language: SupportedLanguage) => void;
  onRemoveLanguage: (languageId: string) => void;
}

export function TargetLanguageDialog({
  open,
  onOpenChange,
  additionalLanguages,
  onAddLanguage,
  onRemoveLanguage,
}: TargetLanguageDialogProps) {
  const { t } = useAppTranslation();
  const [newLanguageName, setNewLanguageName] = useState("");
  const [newLanguageId, setNewLanguageId] = useState("");
  
  // Add new language
  const handleAddLanguage = () => {
    if (!newLanguageName || !newLanguageId) return;
    
    // Add new language
    onAddLanguage({
      name: newLanguageName,
      id: newLanguageId
    });
    
    // Clear input fields
    setNewLanguageName("");
    setNewLanguageId("");
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.targetLanguage')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Available Languages */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.availableLanguages')}</label>
            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
              {DEFAULT_LANGUAGES.map((lang) => (
                <div key={lang.id} className="p-2 flex justify-between items-center">
                  <span>
                    {lang.flag && <span className="mr-2">{lang.flag}</span>}
                    {lang.name} ({lang.id})
                  </span>
                  <span className="text-xs text-muted-foreground">{t('settings.defaultLanguage')}</span>
                </div>
              ))}
              {additionalLanguages.map((lang) => (
                <div key={lang.id} className="p-2 flex justify-between items-center">
                  <span>
                    {lang.flag && <span className="mr-2">{lang.flag}</span>}
                    {lang.name} ({lang.id})
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveLanguage(lang.id)}
                    aria-label={`Remove ${lang.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Add New Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.additionalLanguages')}</label>
            <div className="flex space-x-2">
              <Input 
                placeholder={t('settings.languageName')}
                value={newLanguageName}
                onChange={(e) => setNewLanguageName(e.target.value)}
              />
              <Input 
                placeholder={t('settings.languageId')}
                value={newLanguageId}
                onChange={(e) => setNewLanguageId(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            onClick={handleAddLanguage}
            disabled={!newLanguageName || !newLanguageId}
          >
            {t('settings.addLanguage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
