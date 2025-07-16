"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { useAppTranslation } from "@/lib/i18n";
import { toast } from "sonner";

// Import tabs
import { ModsTab } from "@/components/tabs/mods-tab";
import { QuestsTab } from "@/components/tabs/quests-tab";
import { GuidebooksTab } from "@/components/tabs/guidebooks-tab";
import { CustomFilesTab } from "@/components/tabs/custom-files-tab";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("mods");
  const { setConfig, isTranslating, isScanning } = useAppStore();
  const { t, ready } = useAppTranslation();
  const [mounted, setMounted] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    setMounted(true);
    const loadConfig = async () => {
      try {
        const config = await ConfigService.load();
        setConfig(config);
      } catch (error) {
        console.error("Failed to load configuration:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConfig();
  }, [setConfig]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-4 animate-in fade-in-0 duration-500">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-lg text-muted-foreground">
              {mounted && ready ? t('misc.loading') : 'Loading...'}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const handleTabChange = (value: string) => {
    if (isTranslating) {
      toast.error(t('errors.translationInProgress'), {
        description: t('errors.cannotSwitchTabs'),
      });
      return;
    }
    if (isScanning) {
      toast.error(t('errors.scanInProgress'), {
        description: t('errors.cannotSwitchTabs'),
      });
      return;
    }
    setActiveTab(value);
  };

  return (
    <MainLayout>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mods" disabled={(isTranslating || isScanning) && activeTab !== "mods"}>
            {t('tabs.mods')}
          </TabsTrigger>
          <TabsTrigger value="quests" disabled={(isTranslating || isScanning) && activeTab !== "quests"}>
            {t('tabs.quests')}
          </TabsTrigger>
          <TabsTrigger value="guidebooks" disabled={(isTranslating || isScanning) && activeTab !== "guidebooks"}>
            {t('tabs.guidebooks')}
          </TabsTrigger>
          <TabsTrigger value="custom-files" disabled={(isTranslating || isScanning) && activeTab !== "custom-files"}>
            {t('tabs.customFiles')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{mounted && ready ? t('cards.modTranslation') : 'Mod Translation'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ModsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{mounted && ready ? t('cards.questTranslation') : 'Quest Translation'}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="guidebooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{mounted && ready ? t('cards.guidebookTranslation') : 'Guidebook Translation'}</CardTitle>
            </CardHeader>
            <CardContent>
              <GuidebooksTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="custom-files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{mounted && ready ? t('cards.customFilesTranslation') : 'Custom Files Translation'}</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomFilesTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
