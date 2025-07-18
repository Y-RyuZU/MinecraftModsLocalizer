"use client";

import { useState } from "react";
import { FileService } from "@/lib/services/file-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function TranslationCheckDebug() {
  const [modPath, setModPath] = useState("");
  const [modId, setModId] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("ja_jp");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!modPath || !modId) {
      setResult("Please provide both mod path and mod ID");
      return;
    }

    setLoading(true);
    try {
      // Try the regular check
      const exists = await FileService.invoke<boolean>("check_mod_translation_exists", {
        modPath,
        modId,
        targetLanguage,
      });
      
      setResult(`Translation exists: ${exists}`);

      // If debug command is available, run it for more details
      if (process.env.NODE_ENV === 'development') {
        try {
          const debugInfo = await FileService.invoke<string>("debug_mod_translation_check", {
            modPath,
            modId,
          });
          setResult(`Translation exists: ${exists}\n\nDebug Info:\n${debugInfo}`);
        } catch (error) {
          // Debug command might not be available
          console.log("Debug command not available:", error);
        }
      }
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await FileService.invoke<string>("open_file_dialog", {
        title: "Select Mod JAR",
        filters: [{ name: "JAR Files", extensions: ["jar"] }],
      });
      if (selected) {
        setModPath(selected);
        // Try to extract mod ID from filename
        const filename = selected.split(/[/\\]/).pop() || "";
        const match = filename.match(/^(.+?)-\d+/);
        if (match) {
          setModId(match[1].toLowerCase());
        }
      }
    } catch (error) {
      console.error("Failed to select file:", error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Translation Check Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Mod Path</label>
          <div className="flex gap-2">
            <Input
              value={modPath}
              onChange={(e) => setModPath(e.target.value)}
              placeholder="/path/to/mod.jar"
            />
            <Button onClick={handleSelectFile} variant="outline">
              Browse
            </Button>
          </div>
        </div>
        
        <div>
          <label className="text-sm font-medium">Mod ID</label>
          <Input
            value={modId}
            onChange={(e) => setModId(e.target.value)}
            placeholder="examplemod"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium">Target Language</label>
          <Input
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            placeholder="ja_jp"
          />
        </div>
        
        <Button onClick={handleCheck} disabled={loading} className="w-full">
          {loading ? "Checking..." : "Check Translation"}
        </Button>
        
        {result && (
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md text-sm whitespace-pre-wrap">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}