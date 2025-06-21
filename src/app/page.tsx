"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { UpdateService, UpdateCheckResult } from "@/lib/services/update-service";
import { UpdateDialog } from "@/components/ui/update-dialog";
import { useAppTranslation } from "@/lib/i18n";

// Import tabs
import { ModsTab } from "@/components/tabs/mods-tab";
import { QuestsTab } from "@/components/tabs/quests-tab";
import { GuidebooksTab } from "@/components/tabs/guidebooks-tab";
import { CustomFilesTab } from "@/components/tabs/custom-files-tab";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const { setConfig } = useAppStore();
  const { t } = useAppTranslation();

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await ConfigService.load();
        setConfig(config);
        
        // Check for updates after config is loaded
        // Only check if enabled in config
        if (config.update?.checkOnStartup !== false) {
          // Run asynchronously after a short delay to avoid blocking UI
          setTimeout(async () => {
            try {
              const result = await UpdateService.checkForUpdates();
              // Only show dialog if update is available and not previously dismissed
              if (result.updateAvailable && 
                  config.update?.lastDismissedVersion !== result.latestVersion) {
                setUpdateInfo(result);
                setUpdateDialogOpen(true);
              }
            } catch (error) {
              console.error("Failed to check for updates:", error);
            }
          }, 3000); // Check 3 seconds after startup
        }
        
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
      
      {/* Update Dialog */}
      {updateInfo && (
        <UpdateDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          updateInfo={updateInfo}
        />
      )}
    </MainLayout>
  );
}
