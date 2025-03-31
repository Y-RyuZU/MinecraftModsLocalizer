"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget, PatchouliBook } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";

// Mock functions for development
const mockInvoke = async <T,>(command: string, args?: Record<string, unknown>): Promise<T> => {
  console.log(`Invoking command: ${command}`, args);
  
  if (command === "extract_patchouli_books") {
    // Extract the mod number from the path to create unique IDs
    const modPath = args?.jarPath as string;
    const modNumber = modPath.match(/example-mod-(\d+)\.jar$/)?.[1] || "1";
    
    return [
      {
        id: `example-book-${modNumber}`,
        mod_id: `example-mod-${modNumber}`,
        name: `Example Book ${modNumber}`,
        path: `assets/example/patchouli_books/example-book-${modNumber}`,
        lang_files: [
          {
            language: "en_us",
            path: `assets/example/patchouli_books/example-book-${modNumber}/en_us.json`,
            content: {
              "book.example.name": `Example Book ${modNumber}`,
              "book.example.landing": `Welcome to the Example Book ${modNumber}!`,
              "category.example.basics": "Basics",
              "entry.example.intro": "Introduction"
            }
          }
        ]
      }
    ] as unknown as T;
  }
  
  if (command === "write_patchouli_book") {
    return true as unknown as T;
  }
  
  return {} as T;
};

interface DialogOptions {
  directory: boolean;
  multiple: boolean;
  title: string;
}

const mockOpen = async (options: DialogOptions): Promise<string | null> => {
  console.log('Opening dialog with options:', options);
  return '/mock/path';
};

export function GuidebooksTab() {
  const [isScanning, setIsScanning] = useState(false);
  const { 
    config, 
    translationTargets, 
    setTranslationTargets, 
    updateTranslationTarget,
    isTranslating,
    progress,
    setTranslating,
    setProgress,
    addTranslationResult,
    error,
    setError
  } = useAppStore();

  // Scan for guidebooks
  const handleScanGuidebooks = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      // Check if mods directory is set
      if (!config.paths.modsDir) {
        const selected = await mockOpen({
          directory: true,
          multiple: false,
          title: "Select Minecraft Mods Directory"
        });
        
        if (!selected) {
          setIsScanning(false);
          return;
        }
        
        // Update config with selected directory
        config.paths.modsDir = selected;
      }
      
      // Get mod files
      const modFiles = await FileService.getModFiles(config.paths.modsDir);
      
      // Create translation targets
      const targets: TranslationTarget[] = [];
      
      for (const modFile of modFiles) {
        try {
          // Extract Patchouli books
          const books = await mockInvoke<PatchouliBook[]>("extract_patchouli_books", { 
            jarPath: modFile,
            tempDir: ""
          });
          
          if (books.length > 0) {
            for (const book of books) {
              targets.push({
                type: "patchouli",
                id: book.id,
                name: `${book.mod_id}: ${book.name}`,
                path: modFile,
                selected: false
              });
            }
          }
        } catch (error) {
          console.error(`Failed to extract guidebooks from mod: ${modFile}`, error);
        }
      }
      
      setTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan guidebooks:", error);
      setError(`Failed to scan guidebooks: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all guidebooks
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = translationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setTranslationTargets(updatedTargets);
  };

  // Translate selected guidebooks
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      
      const selectedTargets = translationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError("No guidebooks selected for translation");
        setTranslating(false);
        return;
      }
      
      // Translate each guidebook
      for (let i = 0; i < selectedTargets.length; i++) {
        const target = selectedTargets[i];
        setProgress(Math.round((i / selectedTargets.length) * 100));
        
        try {
          // Extract Patchouli books
          const books = await mockInvoke<PatchouliBook[]>("extract_patchouli_books", { 
            jarPath: target.path,
            tempDir: ""
          });
          
          // Find the book
          const book = books.find(b => b.id === target.id);
          
          if (!book) {
            console.warn(`Book not found: ${target.id}`);
            continue;
          }
          
          // Find source language file
          const sourceFile = book.lang_files.find(file => 
            file.language === config.translation.sourceLanguage
          );
          
          if (!sourceFile) {
            console.warn(`Source language file not found for book: ${target.name}`);
            continue;
          }
          
          // Translate content
          const translatedContent = await translateGuidebookContent(
            sourceFile.content,
            config.translation.sourceLanguage,
            config.translation.targetLanguage
          );
          
          // Write translated file to JAR
          const success = await mockInvoke<boolean>("write_patchouli_book", {
            jarPath: target.path,
            bookId: book.id,
            modId: book.mod_id,
            language: config.translation.targetLanguage,
            content: JSON.stringify(translatedContent)
          });
          
          if (success) {
            // Add translation result
            addTranslationResult({
              type: "patchouli",
              id: target.id,
              sourceLanguage: config.translation.sourceLanguage,
              targetLanguage: config.translation.targetLanguage,
              content: translatedContent,
              outputPath: target.path
            });
          } else {
            console.error(`Failed to write translated guidebook: ${target.name}`);
          }
        } catch (error) {
          console.error(`Failed to translate guidebook: ${target.name}`, error);
        }
      }
      
      setProgress(100);
    } catch (error) {
      console.error("Failed to translate guidebooks:", error);
      setError(`Failed to translate guidebooks: ${error}`);
    } finally {
      setTranslating(false);
    }
  };

  // Translate guidebook content
  const translateGuidebookContent = async (
    content: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<Record<string, string>> => {
    // In a real implementation, this would use the LLM adapter to translate the content
    // For now, we'll just return a mock translation
    const translated: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(content)) {
      translated[key] = `[${targetLanguage}] ${value}`;
    }
    
    return translated;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleScanGuidebooks} disabled={isScanning || isTranslating}>
            {isScanning ? "Scanning..." : "Scan Guidebooks"}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || translationTargets.length === 0}
          >
            {isTranslating ? "Translating..." : "Translate Selected"}
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="bg-destructive/20 text-destructive p-2 rounded">
          {error}
        </div>
      )}
      
      {isTranslating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Translating guidebooks... {progress}%
          </p>
        </div>
      )}
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  disabled={isScanning || isTranslating || translationTargets.length === 0}
                />
              </TableHead>
              <TableHead>Guidebook Name</TableHead>
              <TableHead>Mod ID</TableHead>
              <TableHead>Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {translationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? "Scanning for guidebooks..." : "No guidebooks found. Click 'Scan Guidebooks' to scan for guidebooks."}
                </TableCell>
              </TableRow>
            ) : (
              translationTargets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Checkbox 
                      checked={target.selected}
                      onCheckedChange={(checked) => updateTranslationTarget(target.id, !!checked)}
                      disabled={isScanning || isTranslating}
                    />
                  </TableCell>
                  <TableCell>{target.name}</TableCell>
                  <TableCell>{target.id}</TableCell>
                  <TableCell className="truncate max-w-[300px]">{target.path}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
