"use client";

import { useState, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { LogButton } from "@/components/ui/log-button";
import { CompletionDialog } from "@/components/ui/completion-dialog";
import { TranslationTarget, TranslationResult } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { useAppTranslation } from "@/lib/i18n";
import { TargetLanguageSelector } from "@/components/tabs/target-language-selector";
import { TranslationService } from "@/lib/services/translation-service";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "@/lib/types/config";

// Helper function to get the chunk size for a specific tab type
const getChunkSizeForTabType = (config: AppConfig, tabType: 'mods' | 'quests' | 'guidebooks' | 'custom-files'): number => {
  switch (tabType) {
    case 'mods':
      return config.translation.modChunkSize;
    case 'quests':
      return config.translation.questChunkSize;
    case 'guidebooks':
      return config.translation.guidebookChunkSize;
    case 'custom-files':
      // For custom files, use the mod chunk size as a default
      return config.translation.modChunkSize;
    default:
      return 50; // Default chunk size
  }
};

export interface TranslationTabProps {
  // Tab specific configuration
  tabType: 'mods' | 'quests' | 'guidebooks' | 'custom-files';
  setTranslationServiceRef?: (service: TranslationService) => void;
  scanButtonLabel: string;
  scanningLabel: string;
  progressLabel: string;
  noItemsSelectedError: string;
  noItemsFoundLabel: string;
  scanningForItemsLabel: string;
  directorySelectLabel?: string;
  filterPlaceholder?: string;
  
  // Table configuration
  tableColumns: {
    key: string;
    label: string;
    className?: string;
    render?: (target: TranslationTarget) => ReactNode;
  }[];
  
  // State and handlers
  config: AppConfig;
  translationTargets: TranslationTarget[];
  setTranslationTargets: (targets: TranslationTarget[]) => void;
  updateTranslationTarget: (id: string, selected: boolean) => void;
  isTranslating: boolean;
  progress: number;
  wholeProgress: number;
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setWholeProgress: (progress: number) => void;
  setTotalChunks: (totalChunks: number) => void;
  setCompletedChunks: (completedChunks: number) => void;
  addTranslationResult: (result: TranslationResult) => void;
  error: string | null;
  setError: (error: string | null) => void;
  currentJobId: string | null;
  setCurrentJobId: (jobId: string | null) => void;
  isCompletionDialogOpen: boolean;
  setCompletionDialogOpen: (isOpen: boolean) => void;
  setLogDialogOpen: (isOpen: boolean) => void;
  resetTranslationState: () => void;
  
  // Custom handlers
  onScan: (directory: string) => Promise<void>;
  onTranslate: (
    selectedTargets: TranslationTarget[], 
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string
  ) => Promise<void>;
}

export function TranslationTab({
  // Tab specific configuration
  tabType,
  setTranslationServiceRef,
  scanButtonLabel,
  scanningLabel,
  progressLabel,
  noItemsSelectedError,
  noItemsFoundLabel,
  scanningForItemsLabel,
  directorySelectLabel = 'buttons.selectProfileDirectory',
  filterPlaceholder,

  // Table configuration
  tableColumns,

  // State and handlers
  config,
  translationTargets,
  setTranslationTargets,
  updateTranslationTarget,
  isTranslating,
  progress,
  wholeProgress,
  setTranslating,
  setProgress,
  setWholeProgress,
  setTotalChunks,
  setCompletedChunks,
  addTranslationResult,
  error,
  setError,
  currentJobId,
  setCurrentJobId,
  isCompletionDialogOpen,
  setCompletionDialogOpen,
  setLogDialogOpen,
  resetTranslationState,

  // Custom handlers
  onScan,
  onTranslate
}: TranslationTabProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [tempTargetLanguage, setTempTargetLanguage] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
  const [totalTargets, setTotalTargets] = useState(0);
  const { t } = useAppTranslation();
  
  // Reference to the translation service
  const translationServiceRef = useRef<TranslationService | null>(null);

  // Select directory
  const handleSelectDirectory = async () => {
    try {
      const selected = await FileService.openDirectoryDialog(t(directorySelectLabel));
      
      if (selected) {
        // Store the full path including any prefix
        setSelectedDirectory(selected);
        
        // Clear any previous errors
        setError(null);
        
        // Log the selection type for debugging
        if (selected.startsWith("NATIVE_DIALOG:")) {
          console.log("Native dialog was used!");
        } else {
          console.log("Mock dialog was used!");
          // Only show warning in development mode
          if (process.env.NODE_ENV === 'development') {
            setError("Warning: Mock dialog was used instead of native dialog");
          }
        }
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      setError(`Failed to select directory: ${error}`);
    }
  };

  // Scan for items
  const handleScan = async () => {
    if (!selectedDirectory) {
      setError(t('errors.selectDirectoryFirst'));
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      
      // Extract the actual path from the NATIVE_DIALOG prefix if present
      const actualPath = selectedDirectory.startsWith("NATIVE_DIALOG:") 
        ? selectedDirectory.substring("NATIVE_DIALOG:".length)
        : selectedDirectory;
      
      await onScan(actualPath);
    } catch (error) {
      console.error(`Failed to scan ${tabType}:`, error);
      setError(`Failed to scan ${tabType}: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all items
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = translationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setTranslationTargets(updatedTargets);
  };
  
  // Cancel translation
  const handleCancelTranslation = () => {
    // Provide immediate UI feedback
    setError(t('info.translationCancelled') || "Translation cancelled by user.");
    setTranslating(false);
    setProgress(0);
    setWholeProgress(0);
    
    // Interrupt current job if available
    if (currentJobId && translationServiceRef.current) {
      translationServiceRef.current.interruptJob(currentJobId);
    }
    
    // Clear job reference
    setCurrentJobId(null);
  };

  // Translate selected items
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setWholeProgress(0);
      setTotalChunks(0);
      setCompletedChunks(0);
      setError(null);
      setCurrentJobId(null);

      const selectedTargets = translationTargets.filter(target => target.selected);

      if (selectedTargets.length === 0) {
        setError(t(noItemsSelectedError));
        setTranslating(false);
        return;
      }

      // Use temporary target language
      const targetLanguage = tempTargetLanguage;
      if (!targetLanguage || targetLanguage.trim() === "") {
        setError(t('errors.noTargetLanguageSelected') || "No target language selected");
        setTranslating(false);
        return;
      }

      // Create a translation service
      const translationService = new TranslationService({
        llmConfig: {
          provider: config.llm.provider,
          apiKey: config.llm.apiKey,
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        },
        chunkSize: getChunkSizeForTabType(config, tabType),
        promptTemplate: config.llm.promptTemplate,
        maxRetries: config.llm.maxRetries,
        onProgress: (job) => {
          // Update individual job progress (bounded 0-100)
          const boundedProgress = Math.max(0, Math.min(100, job.progress || 0));
          setProgress(boundedProgress);
        }
      });

      // Store the translation service in the ref
      translationServiceRef.current = translationService;
      if (typeof setTranslationServiceRef === "function") {
        setTranslationServiceRef(translationService);
      }
      
      // Extract the actual path from the NATIVE_DIALOG prefix if present
      const actualPath = selectedDirectory && selectedDirectory.startsWith("NATIVE_DIALOG:")
        ? selectedDirectory.substring("NATIVE_DIALOG:".length)
        : selectedDirectory || "";
      
      // Clear existing logs and create a new logs directory for the entire translation session
      try {
        // Clear existing logs
        await invoke('clear_logs');
        
        // Generate a unique session ID for this translation job
        const sessionId = await invoke<string>('generate_session_id');
        
        // Create a new logs directory using the session ID for uniqueness
        const minecraftDir = config.paths.minecraftDir || actualPath;
        const logsDir = await invoke<string>('create_logs_directory_with_session', { 
          minecraftDir: minecraftDir,
          sessionId: sessionId
        });
        
        // Also create the temp directory with the same session ID for consistency
        const tempDir = await invoke<string>('create_temp_directory_with_session', {
          minecraftDir: minecraftDir,
          sessionId: sessionId
        });
        
        await invoke('log_translation_process', { message: `Created unique session directory: ${logsDir}` });
        await invoke('log_translation_process', { message: `Created temporary directory: ${tempDir}` });
        await invoke('log_translation_process', { message: `Starting translation session ${sessionId} for ${selectedTargets.length} ${tabType} to ${targetLanguage}` });
      } catch (error) {
        console.error('Failed to create logs directory:', error);
        // Continue with translation even if log directory creation fails
      }

      // Clear previous results and set total targets
      setTranslationResults([]);
      setTotalTargets(selectedTargets.length);

      // Create a wrapper for addTranslationResult to collect results locally
      const collectResults = (result: TranslationResult) => {
        setTranslationResults(prev => [...prev, result]);
        addTranslationResult(result);
      };

      // Call the custom translate function (do not await, so UI can update and cancel is possible)
      void onTranslate(
        selectedTargets,
        targetLanguage,
        translationService,
        setCurrentJobId,
        collectResults,
        actualPath
      ).finally(() => {
        // Show completion dialog when translation finishes
        setTimeout(() => {
          setCompletionDialogOpen(true);
        }, 500); // Small delay to ensure UI updates are complete
      });
      
      // Progress will be updated by the translation process itself
    } catch (error) {
      console.error(`Failed to translate ${tabType}:`, error);
      setError(`Failed to translate ${tabType}: ${error}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:gap-2">
          <Button onClick={handleSelectDirectory} disabled={isScanning || isTranslating}>
            {t(directorySelectLabel)}
          </Button>
          <Button 
            onClick={handleScan} 
            disabled={isScanning || isTranslating || !selectedDirectory}
            title={!selectedDirectory ? t('errors.selectDirectoryFirst') : ''}
          >
            {isScanning ? t(scanningLabel) : t(scanButtonLabel)}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || translationTargets.length === 0}
          >
            {isTranslating ? t('buttons.translating') : t('buttons.translate')}
          </Button>
          
          {/* Target Language Selector */}
          <div className="min-w-[200px]">
            <TargetLanguageSelector
              labelKey="tabs.targetLanguage"
              availableLanguages={config.translation.additionalLanguages?.map((lang: { id: string, name: string }) => ({
                id: lang.id,
                code: lang.id,
                name: lang.name
              })) || []}
              selectedLanguage={tempTargetLanguage}
              globalLanguage=""
              onLanguageChange={setTempTargetLanguage}
            />
          </div>
        </div>
        {filterPlaceholder && (
          <div className="flex items-center gap-2 relative">
            <div className="relative w-[250px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t(filterPlaceholder)}
                className="pl-8 w-full" 
                disabled={isScanning || isTranslating}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
      
      {selectedDirectory && (
        <div className="text-sm text-muted-foreground">
          {t('misc.selectedDirectory')} {selectedDirectory.startsWith("NATIVE_DIALOG:") 
            ? selectedDirectory.substring("NATIVE_DIALOG:".length)
            : selectedDirectory}
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/20 text-destructive p-2 rounded">
          {error}
        </div>
      )}
      
      {isTranslating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4 space-y-4">
              {/* Job Progress - Single file progress */}
              <div>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {t(progressLabel)} {progress}%
                  {translationServiceRef.current?.getJob(currentJobId || '')?.currentFileName && (
                    <span className="ml-2">
                      - {translationServiceRef.current?.getJob(currentJobId || '')?.currentFileName}
                    </span>
                  )}
                </p>
              </div>
              
              {/* Whole Progress - Overall progress across all files */}
              <div>
                <Progress value={wholeProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {t('progress.wholeProgress')} {wholeProgress}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LogButton variant="outline" size="sm" />
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleCancelTranslation}
                disabled={!isTranslating}
              >
                {t('buttons.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="border rounded-md">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] sticky top-0 bg-background z-10">
                  <Checkbox 
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    disabled={isScanning || isTranslating || translationTargets.length === 0}
                  />
                </TableHead>
                {tableColumns.map((column) => (
                  <TableHead 
                    key={column.key} 
                    className={cn(
                      column.className,
                      "sticky top-0 bg-background z-10 cursor-pointer",
                      sortColumn === column.key ? "text-primary" : ""
                    )}
                    onClick={() => {
                      if (sortColumn === column.key) {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortColumn(column.key);
                        setSortDirection("asc");
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {t(column.label)}
                      {sortColumn === column.key && (
                        sortDirection === "asc" ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {translationTargets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColumns.length + 1} className="text-center">
                    {isScanning ? t(scanningForItemsLabel) : t(noItemsFoundLabel)}
                  </TableCell>
                </TableRow>
              ) : (
                translationTargets
                  .filter(target => 
                    !filterText || 
                    target.name.toLowerCase().includes(filterText.toLowerCase()) ||
                    target.id.toLowerCase().includes(filterText.toLowerCase())
                  )
                  // 重複したtarget.idを検出して出力する
                  .map(target => {
                    const duplicateIds = translationTargets
                      .filter(t => t.id === target.id)
                      .length > 1;
                    
                    if (duplicateIds) {
                      console.log(`重複したtarget.id: ${target.id} ${target.name}`);
                    }
                    
                    return target;
                  })
                  .sort((a, b) => {
                    const aValue = a[sortColumn as keyof TranslationTarget];
                    const bValue = b[sortColumn as keyof TranslationTarget];
                    
                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                      return sortDirection === "asc" 
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                    }
                    
                    // Fallback for non-string values
                    return 0;
                  })
                  .map((target, index) => (
                      <TableRow key={`${target.id}-${index}`}>
                        <TableCell>
                          <Checkbox 
                            checked={target.selected}
                            onCheckedChange={(checked) => updateTranslationTarget(target.id, !!checked)}
                            disabled={isScanning || isTranslating}
                          />
                        </TableCell>
                        {tableColumns.map((column) => (
                          <TableCell key={`${target.id}-${column.key}`} className={column.className}>
                            {column.render ? column.render(target) : target[column.key as keyof TranslationTarget] as ReactNode}
                          </TableCell>
                        ))}
                      </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      
      {/* Completion Dialog */}
      <CompletionDialog
        open={isCompletionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        results={translationResults}
        hasError={!!error}
        totalItems={totalTargets}
        completedItems={translationResults.length}
        translationType={tabType}
        onViewLogs={() => setLogDialogOpen(true)}
        onFinalize={resetTranslationState}
      />
    </div>
  );
}
