"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { useAppTranslation } from "@/lib/i18n";

// Import tabs
import { ModsTab } from "@/components/tabs/mods-tab";
import { QuestsTab } from "@/components/tabs/quests-tab";
import { GuidebooksTab } from "@/components/tabs/guidebooks-tab";
import { CustomFilesTab } from "@/components/tabs/custom-files-tab";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const { setConfig } = useAppStore();
  const { t } = useAppTranslation();

  // Load configuration on mount
  useEffect(() => {
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
          <p className="text-lg">{t('misc.loading')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Tabs defaultValue="mods" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mods">{t('tabs.mods')}</TabsTrigger>
          <TabsTrigger value="quests">{t('tabs.quests')}</TabsTrigger>
          <TabsTrigger value="guidebooks">{t('tabs.guidebooks')}</TabsTrigger>
          <TabsTrigger value="custom-files">{t('tabs.customFiles')}</TabsTrigger>
        </TabsList>
        <TabsContent value="mods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cards.modTranslation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ModsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cards.questTranslation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="guidebooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cards.guidebookTranslation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GuidebooksTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="custom-files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('cards.customFilesTranslation')}</CardTitle>
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
