"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";

// Import tabs
import { ModsTab } from "@/components/tabs/mods-tab";
import { QuestsTab } from "@/components/tabs/quests-tab";
import { GuidebooksTab } from "@/components/tabs/guidebooks-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const { setConfig } = useAppStore();

  // Load configuration on mount
  useEffect(() => {
    const config = ConfigService.load();
    setConfig(config);
    setIsLoading(false);
  }, [setConfig]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <p className="text-lg">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Tabs defaultValue="mods" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mods">Mods</TabsTrigger>
          <TabsTrigger value="quests">Quests</TabsTrigger>
          <TabsTrigger value="guidebooks">Guidebooks</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="mods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mod Translation</CardTitle>
            </CardHeader>
            <CardContent>
              <ModsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quest Translation</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="guidebooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guidebook Translation</CardTitle>
            </CardHeader>
            <CardContent>
              <GuidebooksTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
