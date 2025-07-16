"use client";

import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/card";
import {Switch} from "@/components/ui/switch";
import {AppConfig} from "@/lib/types/config";
import {useAppTranslation} from "@/lib/i18n";
import {SupportedLanguage} from "@/lib/types/llm";
import {TargetLanguageDialog} from "./target-language-dialog";

interface TranslationSettingsProps {
    config: AppConfig;
    setConfig: (config: AppConfig) => void;
}

export function TranslationSettings({config, setConfig}: TranslationSettingsProps) {
    const {t} = useAppTranslation();
    const [dialogOpen, setDialogOpen] = useState(false);

    // Handle adding additional language
    const handleAddLanguage = (language: SupportedLanguage) => {
        if (!config.translation.additionalLanguages) {
            config.translation.additionalLanguages = [];
        }
        config.translation.additionalLanguages.push(language);
        setConfig({...config});
    };

    // Handle removing additional language
    const handleRemoveLanguage = (languageId: string) => {
        if (config.translation.additionalLanguages) {
            config.translation.additionalLanguages = config.translation.additionalLanguages.filter(
                (lang) => lang.id !== languageId
            );
            setConfig({...config});
        }
    };


    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle>{t('settings.translationSettings')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Target Language Settings */}
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setDialogOpen(true)}
                            >
                                {t('settings.manageTargetLanguage')}
                            </Button>
                        </div>
                    </div>

                    {/* Token-Based Chunking Settings */}
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50 transition-colors duration-200 hover:bg-muted/70">
                        <h3 className="text-sm font-semibold">{t('settings.tokenBasedChunking.title')}</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium">{t('settings.tokenBasedChunking.enable')}</label>
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.tokenBasedChunking.enableHint')}
                                    </p>
                                </div>
                                <Switch
                                    checked={config.translation.useTokenBasedChunking ?? true}
                                    onCheckedChange={(checked) => {
                                        setConfig({
                                            ...config,
                                            translation: {
                                                ...config.translation,
                                                useTokenBasedChunking: checked
                                            }
                                        });
                                    }}
                                />
                            </div>

                            {config.translation.useTokenBasedChunking && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('settings.tokenBasedChunking.maxTokens')}</label>
                                        <Input
                                            type="number"
                                            value={config.translation.maxTokensPerChunk || 3000}
                                            onChange={(e) => {
                                                setConfig({
                                                    ...config,
                                                    translation: {
                                                        ...config.translation,
                                                        maxTokensPerChunk: parseInt(e.target.value) || 3000
                                                    }
                                                });
                                            }}
                                            placeholder={t('settings.tokenBasedChunking.maxTokensPlaceholder')}
                                            min="1000"
                                            max="10000"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {t('settings.tokenBasedChunking.maxTokensHint')}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <label className="text-sm font-medium">{t('settings.tokenBasedChunking.fallback')}</label>
                                            <p className="text-xs text-muted-foreground">
                                                {t('settings.tokenBasedChunking.fallbackHint')}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.translation.fallbackToEntryBased ?? true}
                                            onCheckedChange={(checked) => {
                                                setConfig({
                                                    ...config,
                                                    translation: {
                                                        ...config.translation,
                                                        fallbackToEntryBased: checked
                                                    }
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Skip Existing Translations Setting */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium">{t('settings.skipExistingTranslations.title')}</label>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.skipExistingTranslations.hint')}
                            </p>
                        </div>
                        <Switch
                            checked={config.translation.skipExistingTranslations ?? true}
                            onCheckedChange={(checked) => {
                                setConfig({
                                    ...config,
                                    translation: {
                                        ...config.translation,
                                        skipExistingTranslations: checked
                                    }
                                });
                            }}
                        />
                    </div>

                    {/* Other Translation Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('settings.resourcePackName')}</label>
                            <Input
                                value={config.translation.resourcePackName || "MinecraftModsLocalizer"}
                                onChange={(e) => {
                                    config.translation.resourcePackName = e.target.value;
                                    setConfig({...config});
                                }}
                                placeholder="MinecraftModsLocalizer"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('settings.modChunkSize')}</label>
                            <Input
                                type="number"
                                value={config.translation.modChunkSize || 50}
                                onChange={(e) => {
                                    config.translation.modChunkSize = parseInt(e.target.value);
                                    setConfig({...config});
                                }}
                                placeholder="50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('settings.questChunkSize')}</label>
                            <Input
                                type="number"
                                value={config.translation.questChunkSize || 1}
                                onChange={(e) => {
                                    config.translation.questChunkSize = parseInt(e.target.value);
                                    setConfig({...config});
                                }}
                                placeholder="1"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('settings.guidebookChunkSize')}</label>
                            <Input
                                type="number"
                                value={config.translation.guidebookChunkSize || 1}
                                onChange={(e) => {
                                    config.translation.guidebookChunkSize = parseInt(e.target.value);
                                    setConfig({...config});
                                }}
                                placeholder="1"
                            />
                        </div>
                    </div>
                </div>
            </CardContent>

            <TargetLanguageDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                additionalLanguages={config.translation.additionalLanguages || []}
                onAddLanguage={handleAddLanguage}
                onRemoveLanguage={handleRemoveLanguage}
            />
        </Card>
    );
}