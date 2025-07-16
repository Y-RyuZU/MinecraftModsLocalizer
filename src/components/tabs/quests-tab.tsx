"use client";

import {useAppStore} from "@/lib/store";
import {TranslationResult, TranslationTarget} from "@/lib/types/minecraft";
import {FileService} from "@/lib/services/file-service";
import {TranslationService, TranslationJob} from "@/lib/services/translation-service";
import {TranslationTab} from "@/components/tabs/common/translation-tab";
import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {useEffect} from "react";
import {runTranslationJobs} from "@/lib/services/translation-runner";
import {parseLangFile} from "@/lib/utils/lang-parser";
import {getFileName, getRelativePath} from "@/lib/utils/path-utils";

export function QuestsTab() {
    const {
        config,
        questTranslationTargets,
        setQuestTranslationTargets,
        updateQuestTranslationTarget,
        isTranslating,
        progress,
        wholeProgress,
        setTranslating,
        setProgress,
        setWholeProgress,
        setTotalChunks,
        setCompletedChunks,
        incrementCompletedChunks,
        // Quest-level progress tracking
        setTotalQuests,
        setCompletedQuests,
        incrementCompletedQuests,
        addTranslationResult,
        error,
        setError,
        currentJobId,
        setCurrentJobId,
        isCompletionDialogOpen,
        setCompletionDialogOpen,
        setLogDialogOpen,
        resetTranslationState,
        // Scanning state
        setScanning,
        // Scan progress state
        scanProgress,
        setScanProgress,
        resetScanProgress
    } = useAppStore();

    // Listen for scan progress events
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const setupScanProgressListener = async () => {
            try {
                const unlisten = await listen<{
                    currentFile: string;
                    processedCount: number;
                    totalCount?: number;
                    scanType: string;
                    completed: boolean;
                }>('scan_progress', (event) => {
                    const progress = event.payload;
                    
                    // Only process events for quests scan
                    if (progress.scanType === 'quests') {
                        setScanProgress({
                            currentFile: progress.currentFile,
                            processedCount: progress.processedCount,
                            totalCount: progress.totalCount,
                            scanType: progress.scanType,
                        });
                        
                        // Reset progress after completion
                        if (progress.completed) {
                            setTimeout(() => resetScanProgress(), 500);
                        }
                    }
                });
                
                return unlisten;
            } catch (error) {
                console.error('Failed to set up scan progress listener:', error);
                return () => {};
            }
        };

        const unlistenPromise = setupScanProgressListener();
        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [setScanProgress, resetScanProgress]);

    // Scan for quests
    const handleScan = async (directory: string) => {
        try {
            setScanning(true);
            
            // Set initial scan progress immediately
            setScanProgress({
                currentFile: 'Initializing scan...',
                processedCount: 0,
                totalCount: undefined,
                scanType: 'quests',
            });
            
            // Clear existing targets before scanning
            setQuestTranslationTargets([]);
            
            // Get FTB quest files
            const ftbQuestFiles = await FileService.getFTBQuestFiles(directory);

        // Get Better Quests files
        const betterQuestFiles = await FileService.getBetterQuestFiles(directory);

        // Create translation targets
        const targets: TranslationTarget[] = [];

        // Add FTB quests
        for (let i = 0; i < ftbQuestFiles.length; i++) {
            const questFile = ftbQuestFiles[i];
            try {
                // Update progress for FTB quest analysis phase
                setScanProgress({
                    currentFile: questFile.split('/').pop() || questFile,
                    processedCount: i + 1,
                    totalCount: ftbQuestFiles.length + betterQuestFiles.length,
                    scanType: 'quests',
                });

                // Extract just the filename for the quest name (cross-platform)
                const fileName = getFileName(questFile);
                const questNumber = i + 1;

                // Calculate relative path (cross-platform)
                const relativePath = getRelativePath(questFile, directory);

                targets.push({
                    type: "quest",
                    questFormat: "ftb",
                    id: `ftb-quest-${questNumber}`,
                    name: `FTB Quest ${questNumber}: ${fileName}`,
                    path: questFile,
                    relativePath: relativePath,
                    selected: true
                });
            } catch (error) {
                console.error(`Failed to analyze FTB quest: ${questFile}`, error);
            }
        }

        // Add Better Quests
        for (let i = 0; i < betterQuestFiles.length; i++) {
            const questFile = betterQuestFiles[i];
            try {
                // Update progress for Better quest analysis phase
                setScanProgress({
                    currentFile: questFile.split('/').pop() || questFile,
                    processedCount: ftbQuestFiles.length + i + 1,
                    totalCount: ftbQuestFiles.length + betterQuestFiles.length,
                    scanType: 'quests',
                });

                // Extract just the filename for the quest name (cross-platform)
                const fileName = getFileName(questFile);
                const questNumber = i + 1;

                // Calculate relative path (cross-platform)
                const relativePath = getRelativePath(questFile, directory);

                // Determine if it's a DefaultQuests.lang file (direct mode)
                const isDirectMode = fileName === "DefaultQuests.lang";
                const questName = isDirectMode 
                    ? `Better Quest (Direct): ${fileName}` 
                    : `Better Quest ${questNumber}: ${fileName}`;

                targets.push({
                    type: "quest",
                    questFormat: "better",
                    id: `better-quest-${questNumber}`,
                    name: questName,
                    path: questFile,
                    relativePath: relativePath,
                    selected: true
                });
            } catch (error) {
                console.error(`Failed to analyze Better quest: ${questFile}`, error);
            }
        }

        setQuestTranslationTargets(targets);
        } finally {
            setScanning(false);
            // Reset scan progress after completion
            resetScanProgress();
        }
    };

    // Translate quests
    const handleTranslate = async (
        selectedTargets: TranslationTarget[],
        targetLanguage: string,
        translationService: TranslationService,
        setCurrentJobId: (jobId: string | null) => void,
        addTranslationResult: (result: TranslationResult) => void,
        selectedDirectory: string
    ) => {
        try {
            setTranslating(true);
            
            // Sort targets alphabetically for consistent processing
            const sortedTargets = [...selectedTargets].sort((a, b) => a.name.localeCompare(b.name));
            
            // Reset progress tracking
            setCompletedChunks(0);
            setWholeProgress(0);
            setProgress(0);
            setCompletedQuests(0);
            
            // Set total quests for progress tracking
            setTotalQuests(sortedTargets.length);
                const totalQuests = sortedTargets.length;
            setTotalChunks(totalQuests); // For quests, we track at file level instead of chunk level
            
            // Generate session ID for this translation
            const sessionId = await invoke<string>('generate_session_id');
            
            // Create logs directory with session ID
            const minecraftDir = selectedDirectory;
            const sessionPath = await invoke<string>('create_logs_directory_with_session', {
                minecraftDir: minecraftDir,
                sessionId: sessionId
            });
            
            // Backup SNBT files before translation (only for FTB quests)
            const snbtFiles = sortedTargets
                .filter(target => target.questFormat === 'ftb' && target.path.endsWith('.snbt'))
                .map(target => target.path);
            
            if (snbtFiles.length > 0) {
                try {
                    await invoke('backup_snbt_files', {
                        files: snbtFiles,
                        sessionPath: sessionPath
                    });
                        } catch (error) {
                    console.error('Failed to backup SNBT files:', error);
                    // Continue with translation even if backup fails
                }
            }
            
            // Create jobs for all quests
            const jobs: Array<{
                target: TranslationTarget;
                job: TranslationJob;
                content: string;
            }> = [];
            let skippedCount = 0;
            
            for (const target of sortedTargets) {
                try {
                    // Check if translation already exists when skipExistingTranslations is enabled
                    if (config.translation.skipExistingTranslations ?? true) {
                        const exists = await FileService.invoke<boolean>("check_quest_translation_exists", {
                            questPath: target.path,
                            targetLanguage: targetLanguage
                        });
                        
                        if (exists) {
                            console.log(`Skipping quest ${target.name} - translation already exists`);
                            try {
                                await invoke('log_translation_process', { 
                                    message: `Skipped: ${target.name} - translation already exists`, 
                                    processType: "TRANSLATION" 
                                });
                            } catch {
                                // ignore logging errors
                            }
                            skippedCount++;
                            continue;
                        }
                    }
                    // Read quest file
                    const content = await FileService.readTextFile(target.path);
                    
                    let processedContent = content;
                    
                    // If it's a .lang file, convert to JSON format for translation
                    if (target.path.endsWith('.lang')) {
                        const langMap = parseLangFile(content);
                        
                        // Convert to JSON string for translation
                        processedContent = JSON.stringify(langMap, null, 2);
                    }
                    
                    // Create a translation job
                    const job = translationService.createJob(
                        {content: processedContent},
                        targetLanguage,
                        target.name
                    );
                    
                    jobs.push({ target, job, content: processedContent });
                } catch (error) {
                    console.error(`Failed to prepare quest: ${target.name}`, error);
                    // Add failed result immediately
                    addTranslationResult({
                        type: "quest",
                        id: target.id,
                        targetLanguage: targetLanguage,
                        content: {},
                        outputPath: "",
                        success: false
                    });
                    incrementCompletedChunks();
                }
            }
            
            // Use runTranslationJobs for consistent processing
            await runTranslationJobs({
                jobs: jobs.map(({ job }) => job),
                translationService,
                setCurrentJobId,
                incrementCompletedChunks, // Track at chunk level for real-time progress
                incrementWholeProgress: incrementCompletedQuests, // Track at quest level
                targetLanguage,
                type: "quest",
                sessionId,
                getOutputPath: () => selectedDirectory,
                getResultContent: (job) => translationService.getCombinedTranslatedContent(job.id),
                writeOutput: async (job, outputPath, content) => {
                    // Find the corresponding quest data
                    const questData = jobs.find(j => j.job.id === job.id);
                    if (!questData) return;
                    
                    let translatedText = content.content || `[${targetLanguage}] ${questData.content}`;
                    
                    // Write translated file with language suffix
                    let fileExtension: string;
                    let outputFilePath: string;
                    
                    if (questData.target.questFormat === "ftb") {
                        fileExtension = "snbt";
                    } else {
                        // For BetterQuest, check if it's a .lang file
                        fileExtension = questData.target.path.endsWith('.lang') ? "lang" : "json";
                    }
                    
                    // If it's a .lang file, format the output properly
                    if (fileExtension === "lang") {
                        try {
                            // Parse the translated JSON content
                            const translatedMap = JSON.parse(translatedText);
                            
                            // Convert to .lang format
                            const langLines: string[] = [];
                            const sortedKeys = Object.keys(translatedMap).sort();
                            
                            for (const key of sortedKeys) {
                                langLines.push(`${key}=${translatedMap[key]}`);
                            }
                            
                            translatedText = langLines.join('\n');
                        } catch (error) {
                            console.error('Failed to format .lang file output:', error);
                            // Keep original format if parsing fails
                        }
                    }
                    
                    // Special handling for DefaultQuests.lang files
                    if (questData.target.path.endsWith('DefaultQuests.lang')) {
                        // For direct DefaultQuests.lang, create a copy with language suffix
                        outputFilePath = questData.target.path.replace('.lang', `.${targetLanguage}.lang`);
                    } else {
                        // Check if the file already has a language suffix and remove it
                        const languagePattern = /\.[a-z]{2}_[a-z]{2}\.(snbt|json|lang)$/;
                        let basePath = questData.target.path;
                        
                        // Remove existing language suffix if present
                        if (languagePattern.test(basePath)) {
                            basePath = basePath.replace(languagePattern, `.${fileExtension}`);
                        }
                        
                        // Now add the new language suffix
                        outputFilePath = basePath.replace(
                            `.${fileExtension}`,
                            `.${targetLanguage}.${fileExtension}`
                        );
                    }
                    
                    await FileService.writeTextFile(outputFilePath, translatedText);
                },
                onResult: addTranslationResult,
                onJobStart: async (job) => {
                    const questData = jobs.find(j => j.job.id === job.id);
                    if (!questData) return;
                    try {
                        await invoke('log_translation_process', {
                            message: `Starting translation for quest: ${questData.target.name} (${questData.target.id})`
                        });
                    } catch {}
                },
                onJobComplete: async (job) => {
                    const questData = jobs.find(j => j.job.id === job.id);
                    if (!questData) return;
                    try {
                        await invoke('log_translation_process', {
                            message: `Completed translation for quest: ${questData.target.name} (${questData.target.id})`
                        });
                    } catch {}
                },
                onJobInterrupted: async (job) => {
                    const questData = jobs.find(j => j.job.id === job.id);
                    if (!questData) return;
                    try {
                        await invoke('log_translation_process', {
                            message: `Translation cancelled by user during quest: ${questData.target.name} (${questData.target.id})`
                        });
                    } catch {}
                }
            });
            
            // Log skipped items summary
            if (skippedCount > 0) {
                try {
                    await invoke('log_translation_process', { 
                        message: `Translation completed. Skipped ${skippedCount} quests that already have translations.`, 
                        processType: "TRANSLATION" 
                    });
                } catch {
                    // ignore logging errors
                }
            }
        } finally {
            setTranslating(false);
        }
    };

    // Custom render function for the type column
    const renderQuestType = (target: TranslationTarget) => {
        const isFTB = target.questFormat === "ftb";
        const isDirectMode = !isFTB && target.path.endsWith('DefaultQuests.lang');
        
        let type: string;
        let className: string;
        
        if (isFTB) {
            type = "FTB Quest";
            className = "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
        } else if (isDirectMode) {
            type = "Better Quest (Direct)";
            className = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        } else {
            type = "Better Quest";
            className = "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
        }
        
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
                {type}
            </span>
        );
    };

    return (
        <TranslationTab
            tabType="quests"
            scanButtonLabel="buttons.scanQuests"
            scanningLabel="buttons.scanning"
            progressLabel="progress.translatingQuests"
            noItemsSelectedError="errors.noQuestsSelected"
            noItemsFoundLabel="tables.noQuestsFound"
            scanningForItemsLabel="tables.scanningForQuests"
            filterPlaceholder="filters.filterQuests"
            tableColumns={[
                {key: "name", label: "tables.questName"},
                {key: "type", label: "tables.type", render: renderQuestType},
                {
                    key: "relativePath",
                    label: "tables.path",
                    render: (target) => target.relativePath || getFileName(target.path)
                }
            ]}
            config={config}
            translationTargets={questTranslationTargets}
            setTranslationTargets={setQuestTranslationTargets}
            updateTranslationTarget={updateQuestTranslationTarget}
            isTranslating={isTranslating}
            progress={progress}
            wholeProgress={wholeProgress}
            setTranslating={setTranslating}
            setProgress={setProgress}
            setWholeProgress={setWholeProgress}
            setTotalChunks={setTotalChunks}
            setCompletedChunks={setCompletedChunks}
            addTranslationResult={addTranslationResult}
            error={error}
            setError={setError}
            currentJobId={currentJobId}
            setCurrentJobId={setCurrentJobId}
            isCompletionDialogOpen={isCompletionDialogOpen}
            setCompletionDialogOpen={setCompletionDialogOpen}
            setLogDialogOpen={setLogDialogOpen}
            resetTranslationState={resetTranslationState}
            scanProgress={scanProgress}
            onScan={handleScan}
            onTranslate={handleTranslate}
        />
    );
}