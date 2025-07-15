"use client";

import {useAppStore} from "@/lib/store";
import {TranslationResult, TranslationTarget} from "@/lib/types/minecraft";
import {FileService} from "@/lib/services/file-service";
import {TranslationService, TranslationJob} from "@/lib/services/translation-service";
import {TranslationTab} from "@/components/tabs/common/translation-tab";
import {invoke} from "@tauri-apps/api/core";
import {runTranslationJobs} from "@/lib/services/translation-runner";
import {parseLangFile} from "@/lib/utils/lang-parser";

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
        addTranslationResult,
        error,
        setError,
        currentJobId,
        setCurrentJobId,
        isCompletionDialogOpen,
        setCompletionDialogOpen,
        setLogDialogOpen,
        resetTranslationState
    } = useAppStore();

    // Scan for quests
    const handleScan = async (directory: string) => {
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
                // Extract just the filename for the quest name
                const fileName = questFile.split(/[/\\]/).pop() || "unknown";
                const questNumber = i + 1;

                // Calculate relative path by removing the selected directory part
                const relativePath = questFile.startsWith(directory)
                    ? questFile.substring(directory.length).replace(/^[/\\]+/, '')
                    : questFile;

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
                // Extract just the filename for the quest name
                const fileName = questFile.split(/[/\\]/).pop() || "unknown";
                const questNumber = i + 1;

                // Calculate relative path by removing the selected directory part
                const relativePath = questFile.startsWith(directory)
                    ? questFile.substring(directory.length).replace(/^[/\\]+/, '')
                    : questFile;

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
            
            // Set total quests for progress tracking
            const totalQuests = sortedTargets.length;
            setTotalChunks(totalQuests); // For quests, we track at file level instead of chunk level
            
            // Create jobs for all quests
            const jobs: Array<{
                target: TranslationTarget;
                job: TranslationJob;
                content: string;
            }> = [];
            
            for (const target of sortedTargets) {
                try {
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
                incrementWholeProgress: incrementCompletedChunks, // Track at quest level
                targetLanguage,
                type: "quest",
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
        } finally {
            setTranslating(false);
        }
    };

    // Custom render function for the type column
    const renderQuestType = (target: TranslationTarget) => {
        if (target.questFormat === "ftb") {
            return "FTB Quest";
        } else {
            // For BetterQuest, show if it's direct mode
            const isDirectMode = target.path.endsWith('DefaultQuests.lang');
            return isDirectMode ? "Better Quest (Direct)" : "Better Quest";
        }
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
                    className: "truncate max-w-[300px]",
                    render: (target) => target.relativePath || target.path
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
            onScan={handleScan}
            onTranslate={handleTranslate}
        />
    );
}