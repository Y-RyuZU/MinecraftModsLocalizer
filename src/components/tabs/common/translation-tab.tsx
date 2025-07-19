"use client";

import {useState, useRef, ReactNode} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {ScrollArea} from "@/components/ui/scroll-area";
import {ChevronDown, ChevronUp, Search} from "lucide-react";
import {cn} from "@/lib/utils";
import {Checkbox} from "@/components/ui/checkbox";
import {Progress} from "@/components/ui/progress";
import {LogButton} from "@/components/ui/log-button";
import {CompletionDialog} from "@/components/ui/completion-dialog";
import {TranslationTarget, TranslationResult} from "@/lib/types/minecraft";
import {FileService} from "@/lib/services/file-service";
import {useAppTranslation} from "@/lib/i18n";
import {TargetLanguageSelector} from "@/components/tabs/target-language-selector";
import {TranslationService} from "@/lib/services/translation-service";
import {invoke} from "@tauri-apps/api/core";
import type {AppConfig} from "@/lib/types/config";
import {useAppStore} from "@/lib/store";
import {toast} from "sonner";

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
    
    // Scan progress state
    scanProgress?: {
        currentFile: string;
        processedCount: number;
        totalCount?: number;
        scanType?: string;
    };

    // Custom handlers
    onScan: (directory: string, targetLanguage?: string) => Promise<void>;
    onTranslate: (
        selectedTargets: TranslationTarget[],
        targetLanguage: string,
        translationService: TranslationService,
        setCurrentJobId: (jobId: string | null) => void,
        addTranslationResult: (result: TranslationResult) => void,
        selectedDirectory: string,
        sessionId: string
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
                                   addTranslationResult,
                                   error,
                                   setError,
                                   currentJobId,
                                   setCurrentJobId,
                                   isCompletionDialogOpen,
                                   setCompletionDialogOpen,
                                   setLogDialogOpen,
                                   resetTranslationState,
                                   
                                   // Scan progress state
                                   scanProgress,

                                   // Custom handlers
                                   onScan,
                                   onTranslate
                               }: TranslationTabProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [filterText, setFilterText] = useState("");
    const [tempTargetLanguage, setTempTargetLanguage] = useState<string | null>(null);
    const [sortColumn, setSortColumn] = useState<string>("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [translationResults, setTranslationResults] = useState<TranslationResult[]>([]);
    const [totalTargets, setTotalTargets] = useState(0);
    const {t} = useAppTranslation();
    
    // Get shared profile directory from store
    const profileDirectory = useAppStore(state => state.profileDirectory);
    const setProfileDirectory = useAppStore(state => state.setProfileDirectory);

    // Reference to the translation service
    const translationServiceRef = useRef<TranslationService | null>(null);
    // Flag to track if translation was cancelled
    const wasCancelledRef = useRef<boolean>(false);

    // Select directory
    const handleSelectDirectory = async () => {
        try {
            const selected = await FileService.openDirectoryDialog(t(directorySelectLabel));

            if (selected) {
                // Validate the directory path
                if (!selected.trim()) {
                    setError(t('errors.invalidDirectory', 'Invalid directory selected'));
                    return;
                }

                // Store the full path including any prefix in shared state
                setProfileDirectory(selected);

                // Clear any previous errors
                setError(null);

                // Log the selection for debugging
                if (process.env.NODE_ENV === 'development') {
                    console.log("Directory selected:", selected);
                }
            }
        } catch (error) {
            console.error("Failed to select directory:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setError(t('errors.directorySelectionFailed', `Failed to select directory: ${errorMessage}`));
            toast.error(t('errors.directorySelectionFailed', 'Failed to select directory'), {
                description: errorMessage
            });
        }
    };

    // Scan for items
    const handleScan = async () => {
        if (!profileDirectory) {
            setError(t('errors.selectProfileDirectoryFirst'));
            toast.error(t('errors.selectProfileDirectoryFirst', 'Please select a profile directory first'));
            return;
        }

        try {
            setIsScanning(true);
            setError(null);
            
            // Use the profile directory path directly
            const actualPath = profileDirectory;

            // Clear existing results after UI has updated
            requestAnimationFrame(() => {
                setTranslationTargets([]);
                setFilterText("");
                setTranslationResults([]);
            });

            await onScan(actualPath, tempTargetLanguage || undefined);
        } catch (error) {
            console.error(`Failed to scan ${tabType}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Check if the error is a translation key with path
            if (errorMessage.startsWith('errors.') && errorMessage.includes(':::')) {
                const [translationKey, path] = errorMessage.split(':::');
                setError(t(translationKey, { path }));
            } else if (errorMessage.startsWith('errors.')) {
                setError(t(errorMessage));
            } else {
                setError(`Failed to scan ${tabType}: ${errorMessage}`);
                toast.error(t('errors.scanFailed', 'Scan failed'), {
                    description: errorMessage
                });
            }
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
        // Set cancellation flag
        wasCancelledRef.current = true;

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
            // Reset cancellation flag
            wasCancelledRef.current = false;

            // Reset translation state immediately
            resetTranslationState();
            setTranslating(true);
            setProgress(0);
            setWholeProgress(0);
            setError(null);

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
            
            // Pre-check for existing translations if skipExistingTranslations is enabled
            if ((config.translation.skipExistingTranslations ?? true) && tabType === 'mods') {
                let existingCount = 0;
                for (const target of selectedTargets) {
                    try {
                        const exists = await FileService.invoke<boolean>("check_mod_translation_exists", {
                            modPath: target.path,
                            modId: target.id,
                            targetLanguage: targetLanguage
                        });
                        if (exists) {
                            existingCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to check existing translation for ${target.name}:`, error);
                    }
                }
                
                // Show warning if all selected mods already have translations
                if (existingCount === selectedTargets.length) {
                    toast.warning(t('warnings.allModsAlreadyTranslated', 'All selected mods already have translations'), {
                        description: t('warnings.noNewTranslationsNeeded', 'No new translations will be created.'),
                        duration: 5000
                    });
                    setTranslating(false);
                    return;
                } else if (existingCount > 0) {
                    toast.info(t('info.someModsAlreadyTranslated', `${existingCount} of ${selectedTargets.length} mods already have translations`), {
                        description: t('info.willSkipExisting', 'These will be skipped.'),
                        duration: 3000
                    });
                }
            }

            // Get provider-specific API key
            const provider = config.llm.provider as keyof typeof config.llm.apiKeys;
            const apiKey = config.llm.apiKeys?.[provider] || config.llm.apiKey || "";
            
            // Create a translation service
            const translationService = new TranslationService({
                llmConfig: {
                    provider: config.llm.provider,
                    apiKey: apiKey,
                    baseUrl: config.llm.baseUrl,
                    model: config.llm.model,
                },
                chunkSize: getChunkSizeForTabType(config, tabType),
                promptTemplate: config.llm.promptTemplate,
                maxRetries: config.llm.maxRetries,
                // Token-based chunking configuration
                useTokenBasedChunking: config.translation.useTokenBasedChunking,
                maxTokensPerChunk: config.translation.maxTokensPerChunk,
                fallbackToEntryBased: config.translation.fallbackToEntryBased
                // Remove onProgress callback to prevent duplicate updates
                // Progress is now handled directly by translation-runner.ts
            });

            // Store the translation service in the ref
            translationServiceRef.current = translationService;
            if (typeof setTranslationServiceRef === "function") {
                setTranslationServiceRef(translationService);
            }

            // Use the profile directory path directly
            const actualPath = profileDirectory || "";

            // Generate a unique session ID for this translation job
            const sessionId = await invoke<string>('generate_session_id');

            // Create a new logs directory for the entire translation session
            try {
                // Clear log viewer for new session (file logs from previous sessions are preserved)
                await invoke('clear_logs');

                // Create a new logs directory using the session ID for uniqueness
                // Use the shared profile directory
                const minecraftDir = actualPath;
                
                const logsDir = await invoke<string>('create_logs_directory_with_session', {
                    minecraftDir: minecraftDir,
                    sessionId: sessionId
                });

                // Also create the temp directory with the same session ID for consistency
                const tempDir = await invoke<string>('create_temp_directory_with_session', {
                    minecraftDir: minecraftDir,
                    sessionId: sessionId
                });

                await invoke('log_translation_process', {message: `Created unique session directory: ${logsDir}`});
                await invoke('log_translation_process', {message: `Created temporary directory: ${tempDir}`});
                await invoke('log_translation_process', {message: `Starting translation session ${sessionId} for ${selectedTargets.length} ${tabType} to ${targetLanguage}`});
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
                actualPath,
                sessionId
            ).finally(() => {
                // Show completion dialog only if translation was not cancelled
                if (!wasCancelledRef.current) {
                    setTimeout(() => {
                        setCompletionDialogOpen(true);
                    }, 500); // Small delay to ensure UI updates are complete
                }
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
                        disabled={isScanning || isTranslating || !profileDirectory}
                        title={!profileDirectory ? t('errors.selectProfileDirectoryFirst') : ''}
                        className={isScanning ? 'animate-pulse' : ''}
                    >
                        {isScanning && (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        )}
                        {isScanning ? t(scanningLabel) : t(scanButtonLabel)}
                    </Button>
                    <Button
                        onClick={handleTranslate}
                        disabled={isScanning || isTranslating || translationTargets.length === 0}
                        className={isTranslating ? 'animate-pulse' : ''}
                    >
                        {isTranslating && (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        )}
                        {isTranslating ? t('buttons.translating') : t('buttons.translate')}
                    </Button>

                    {/* Target Language Selector */}
                    <div className="min-w-[200px] 2xl:min-w-[250px]">
                        <TargetLanguageSelector
                            labelKey="tabs.targetLanguage"
                            availableLanguages={config.translation.additionalLanguages?.map((lang: {
                                id: string,
                                name: string
                            }) => ({
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
                        <div className="relative w-[250px] 2xl:w-[350px]">
                            <Search
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
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

            {profileDirectory && (
                <div className="text-sm text-muted-foreground">
                    {t('misc.selectedDirectory')} {profileDirectory}
                </div>
            )}

            {error && (
                <div className="bg-destructive/20 text-destructive p-2 rounded animate-in fade-in-0 slide-in-from-top-2 duration-300">
                    {error}
                </div>
            )}

            {isTranslating && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4 space-y-4">
                            {/* Job Progress - Single file progress */}
                            <div>
                                <Progress value={progress} className="h-2"/>
                                <p className="text-sm 2xl:text-base text-muted-foreground">
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
                                <Progress value={wholeProgress} className="h-2"/>
                                <p className="text-sm 2xl:text-base text-muted-foreground">
                                    {t('progress.wholeProgress')} {wholeProgress}%
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <LogButton variant="outline" size="sm"/>
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
                <ScrollArea className="h-[60vh] min-h-[500px] 2xl:h-[70vh] 2xl:min-h-[600px]" orientation="both">
                    <div className="w-max min-w-full">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px] 2xl:w-[60px] sticky top-0 bg-background z-10">
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
                                                    <ChevronUp className="h-4 w-4"/> :
                                                    <ChevronDown className="h-4 w-4"/>
                                            )}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {translationTargets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={tableColumns.length + 1} className="text-center py-16">
                                        {isScanning ? (
                                            <div className="flex flex-col items-center gap-4 animate-in fade-in-0 duration-300">
                                                <div className="relative">
                                                    {/* Outer spinning ring */}
                                                    <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                                                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent transition-all duration-300"></div>
                                                    
                                                    {/* Inner pulsing circle */}
                                                    <div className="absolute inset-2 animate-pulse rounded-full bg-primary/20"></div>
                                                </div>
                                                
                                                <div className="w-96 space-y-3">
                                                    <p className="text-lg 2xl:text-xl font-medium text-left truncate">
                                                        {scanProgress?.currentFile ? 
                                                            `Scanning: ${scanProgress.currentFile}` : 
                                                            t(scanningForItemsLabel)
                                                        }
                                                    </p>
                                                    <p className="text-sm 2xl:text-base text-muted-foreground text-center">
                                                        {(scanProgress?.processedCount ?? 0) > 0 ? 
                                                            scanProgress?.totalCount ? 
                                                                `(${scanProgress.processedCount} / ${scanProgress.totalCount} files - ${Math.round((scanProgress.processedCount / scanProgress.totalCount) * 100)}%)` :
                                                                `(${scanProgress?.processedCount} files)` : 
                                                            t('misc.pleaseWait')
                                                        }
                                                    </p>
                                                    
                                                    {/* Small progress bar for scan progress - fixed width */}
                                                    {scanProgress?.totalCount && (scanProgress?.processedCount ?? 0) > 0 && (
                                                        <div className="w-80 mx-auto">
                                                            <Progress 
                                                                value={Math.round((scanProgress.processedCount / scanProgress.totalCount) * 100)} 
                                                                className="h-1.5" 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Progress dots animation */}
                                                <div className="flex gap-1">
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground">{t(noItemsFoundLabel)}</p>
                                        )}
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

                                        if (duplicateIds && process.env.NODE_ENV === 'development') {
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
                                        <TableRow key={`${target.id}-${index}`} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={target.selected}
                                                    onCheckedChange={(checked) => updateTranslationTarget(target.id, !!checked)}
                                                    disabled={isScanning || isTranslating}
                                                />
                                            </TableCell>
                                            {tableColumns.map((column) => (
                                                <TableCell key={`${target.id}-${column.key}`}
                                                           className={column.className}>
                                                    {column.render ? column.render(target) : target[column.key as keyof TranslationTarget] as ReactNode}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                            )}
                        </TableBody>
                    </Table>
                    </div>
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
