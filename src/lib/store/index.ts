import { create } from 'zustand';
import { AppConfig, DEFAULT_CONFIG } from '../types/config';
import { TranslationTarget, TranslationResult } from '../types/minecraft';

/**
 * Application state
 */
interface AppState {
  // Configuration
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  updateConfig: (partialConfig: Partial<AppConfig>) => void;
  
  // Translation targets - separated by type
  modTranslationTargets: TranslationTarget[];
  questTranslationTargets: TranslationTarget[];
  guidebookTranslationTargets: TranslationTarget[];
  customFilesTranslationTargets: TranslationTarget[];
  
  // Translation targets actions
  setModTranslationTargets: (targets: TranslationTarget[]) => void;
  setQuestTranslationTargets: (targets: TranslationTarget[]) => void;
  setGuidebookTranslationTargets: (targets: TranslationTarget[]) => void;
  setCustomFilesTranslationTargets: (targets: TranslationTarget[]) => void;
  
  updateModTranslationTarget: (id: string, selected: boolean) => void;
  updateQuestTranslationTarget: (id: string, selected: boolean) => void;
  updateGuidebookTranslationTarget: (id: string, selected: boolean) => void;
  updateCustomFilesTranslationTarget: (id: string, selected: boolean) => void;
  
  // Translation progress
  isTranslating: boolean;
  progress: number;
  wholeProgress: number;
  totalChunks: number;
  completedChunks: number;
  // Mod-level progress tracking
  totalMods: number;
  completedMods: number;
  // Quest-level progress tracking
  totalQuests: number;
  completedQuests: number;
  // Guidebook-level progress tracking
  totalGuidebooks: number;
  completedGuidebooks: number;
  // Custom files-level progress tracking
  totalCustomFiles: number;
  completedCustomFiles: number;
  currentJobId: string | null;
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setWholeProgress: (progress: number) => void;
  setTotalChunks: (totalChunks: number) => void;
  setCompletedChunks: (completedChunks: number) => void;
  incrementCompletedChunks: () => void;
  updateProgressTracking: (completedChunks: number, totalChunks: number) => void;
  // Mod-level progress methods
  setTotalMods: (totalMods: number) => void;
  setCompletedMods: (completedMods: number) => void;
  incrementCompletedMods: () => void;
  updateModProgress: (completedMods: number, totalMods: number) => void;
  // Quest-level progress methods
  setTotalQuests: (totalQuests: number) => void;
  setCompletedQuests: (completedQuests: number) => void;
  incrementCompletedQuests: () => void;
  updateQuestProgress: (completedQuests: number, totalQuests: number) => void;
  // Guidebook-level progress methods
  setTotalGuidebooks: (totalGuidebooks: number) => void;
  setCompletedGuidebooks: (completedGuidebooks: number) => void;
  incrementCompletedGuidebooks: () => void;
  updateGuidebookProgress: (completedGuidebooks: number, totalGuidebooks: number) => void;
  // Custom files-level progress methods
  setTotalCustomFiles: (totalCustomFiles: number) => void;
  setCompletedCustomFiles: (completedCustomFiles: number) => void;
  incrementCompletedCustomFiles: () => void;
  updateCustomFilesProgress: (completedCustomFiles: number, totalCustomFiles: number) => void;
  setCurrentJobId: (jobId: string | null) => void;
  
  // Translation results
  translationResults: TranslationResult[];
  historicalResults: TranslationResult[];
  addTranslationResult: (result: TranslationResult) => void;
  clearTranslationResults: () => void;
  saveResultsToHistory: () => void;
  clearHistoricalResults: () => void;
  
  // Errors
  error: string | null;
  setError: (error: string | null) => void;
  
  // UI state
  isLogDialogOpen: boolean;
  setLogDialogOpen: (isOpen: boolean) => void;
  isCompletionDialogOpen: boolean;
  setCompletionDialogOpen: (isOpen: boolean) => void;
  resetTranslationState: () => void;
  
  // Scanning state
  isScanning: boolean;
  setScanning: (isScanning: boolean) => void;
  
  // Scan progress state
  scanProgress: {
    currentFile: string;
    processedCount: number;
    totalCount?: number;
    scanType?: string;
  };
  setScanProgress: (progress: Partial<{currentFile: string; processedCount: number; totalCount?: number; scanType?: string}>) => void;
  resetScanProgress: () => void;
}

/**
 * Create the application store
 */
export const useAppStore = create<AppState>((set) => ({
  // Configuration
  config: DEFAULT_CONFIG,
  setConfig: (config) => set({ config }),
  updateConfig: (partialConfig) => 
    set((state) => ({ 
      config: { ...state.config, ...partialConfig } 
    })),
  
  // Translation targets - separated by type
  modTranslationTargets: [],
  questTranslationTargets: [],
  guidebookTranslationTargets: [],
  customFilesTranslationTargets: [],
  
  // Translation targets actions
  setModTranslationTargets: (targets) => set({ modTranslationTargets: targets }),
  setQuestTranslationTargets: (targets) => set({ questTranslationTargets: targets }),
  setGuidebookTranslationTargets: (targets) => set({ guidebookTranslationTargets: targets }),
  setCustomFilesTranslationTargets: (targets) => set({ customFilesTranslationTargets: targets }),
  
  updateModTranslationTarget: (id, selected) => 
    set((state) => ({
      modTranslationTargets: state.modTranslationTargets.map((target) => 
        target.id === id ? { ...target, selected } : target
      )
    })),
  
  updateQuestTranslationTarget: (id, selected) => 
    set((state) => ({
      questTranslationTargets: state.questTranslationTargets.map((target) => 
        target.id === id ? { ...target, selected } : target
      )
    })),
  
  updateGuidebookTranslationTarget: (id, selected) => 
    set((state) => ({
      guidebookTranslationTargets: state.guidebookTranslationTargets.map((target) => 
        target.id === id ? { ...target, selected } : target
      )
    })),
  
  updateCustomFilesTranslationTarget: (id, selected) => 
    set((state) => ({
      customFilesTranslationTargets: state.customFilesTranslationTargets.map((target) => 
        target.id === id ? { ...target, selected } : target
      )
    })),
  
  // Translation progress
  isTranslating: false,
  progress: 0,
  wholeProgress: 0,
  totalChunks: 0,
  completedChunks: 0,
  // Mod-level progress state
  totalMods: 0,
  completedMods: 0,
  // Quest-level progress state
  totalQuests: 0,
  completedQuests: 0,
  // Guidebook-level progress state
  totalGuidebooks: 0,
  completedGuidebooks: 0,
  // Custom files-level progress state
  totalCustomFiles: 0,
  completedCustomFiles: 0,
  currentJobId: null,
  setTranslating: (isTranslating) => set({ isTranslating }),
  setProgress: (progress) => set(() => {
    const newProgress = Math.max(0, Math.min(100, progress || 0));
    // Allow progress to be reset for each file
    return { progress: newProgress };
  }),
  setWholeProgress: (progress) => set((state) => {
    const newProgress = Math.max(0, Math.min(100, progress || 0));
    // Allow resetting to 0 when not translating or when explicitly setting to 0
    if (newProgress < state.wholeProgress && state.isTranslating && newProgress !== 0) {
      return state;
    }
    return { wholeProgress: newProgress };
  }),
  setTotalChunks: (totalChunks) => {
    return set({ totalChunks: Math.max(0, totalChunks || 0) });
  },
  setCompletedChunks: (completedChunks) => set({ completedChunks: Math.max(0, completedChunks || 0) }),
  incrementCompletedChunks: () => set((state) => {
    // Prevent exceeding totalChunks
    const newCompletedChunks = Math.min(state.completedChunks + 1, state.totalChunks);
    // Calculate progress with bounds checking (0-100)
    const rawProgress = state.totalChunks > 0 ? (newCompletedChunks / state.totalChunks * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    // Log progress milestones (every 25%)
    const prevProgress = state.totalChunks > 0 ? Math.round((state.completedChunks / state.totalChunks) * 100) : 0;
    const currentMilestone = Math.floor(boundedProgress / 25) * 25;
    const prevMilestone = Math.floor(prevProgress / 25) * 25;
    
    if (currentMilestone > prevMilestone && boundedProgress > 0) {
      // Log milestone reached (async operation, don't await to avoid blocking state update)
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke('log_translation_process', { 
          message: `Translation progress milestone: ${currentMilestone}% (${newCompletedChunks}/${state.totalChunks} chunks)` 
        }).catch(error => console.error('Failed to log progress milestone:', error));
      });
    }
    
    return {
      completedChunks: newCompletedChunks
      // Progress is updated by setProgress for individual files
      // wholeProgress is updated by incrementCompletedMods
    };
  }),
  updateProgressTracking: (completedChunks, totalChunks) => set(() => {
    // Validate inputs
    const validTotalChunks = Math.max(1, totalChunks || 1);
    const validCompletedChunks = Math.max(0, Math.min(completedChunks || 0, validTotalChunks));
    
    return {
      completedChunks: validCompletedChunks,
      totalChunks: validTotalChunks
      // Progress is updated by setProgress for individual files
      // wholeProgress is updated by updateModProgress
    };
  }),
  // Mod-level progress methods
  setTotalMods: (totalMods) => {
    return set({ totalMods: Math.max(0, totalMods || 0) });
  },
  setCompletedMods: (completedMods) => set({ completedMods: Math.max(0, completedMods || 0) }),
  incrementCompletedMods: () => set((state) => {
    // Prevent exceeding totalMods
    const newCompletedMods = Math.min(state.completedMods + 1, state.totalMods);
    // Calculate progress with bounds checking (0-100)
    const rawProgress = state.totalMods > 0 ? (newCompletedMods / state.totalMods * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    // Log mod completion milestones
    const prevProgress = state.totalMods > 0 ? Math.round((state.completedMods / state.totalMods) * 100) : 0;
    const currentMilestone = Math.floor(boundedProgress / 25) * 25;
    const prevMilestone = Math.floor(prevProgress / 25) * 25;
    
    if (currentMilestone > prevMilestone && boundedProgress > 0) {
      // Log milestone reached (async operation, don't await to avoid blocking state update)
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke('log_translation_process', { 
          message: `File processing milestone: ${currentMilestone}% (${newCompletedMods}/${state.totalMods} files)` 
        }).catch(error => console.error('Failed to log mod milestone:', error));
      });
    }
    
    return {
      completedMods: newCompletedMods,
      wholeProgress: boundedProgress
    };
  }),
  updateModProgress: (completedMods, totalMods) => set(() => {
    // Validate inputs
    const validTotalMods = Math.max(1, totalMods || 1);
    const validCompletedMods = Math.max(0, Math.min(completedMods || 0, validTotalMods));
    
    // Calculate progress with bounds checking (0-100)
    const rawProgress = (validCompletedMods / validTotalMods) * 100;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedMods: validCompletedMods,
      totalMods: validTotalMods,
      wholeProgress: boundedProgress
    };
  }),
  // Quest-level progress methods
  setTotalQuests: (totalQuests) => {
    return set({ totalQuests: Math.max(0, totalQuests || 0) });
  },
  setCompletedQuests: (completedQuests) => set({ completedQuests: Math.max(0, completedQuests || 0) }),
  incrementCompletedQuests: () => set((state) => {
    const newCompletedQuests = Math.min(state.completedQuests + 1, state.totalQuests);
    const rawProgress = state.totalQuests > 0 ? (newCompletedQuests / state.totalQuests * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedQuests: newCompletedQuests,
      wholeProgress: boundedProgress
    };
  }),
  updateQuestProgress: (completedQuests, totalQuests) => set(() => {
    const validTotalQuests = Math.max(1, totalQuests || 1);
    const validCompletedQuests = Math.max(0, Math.min(completedQuests || 0, validTotalQuests));
    const rawProgress = (validCompletedQuests / validTotalQuests) * 100;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedQuests: validCompletedQuests,
      totalQuests: validTotalQuests,
      wholeProgress: boundedProgress
    };
  }),
  // Guidebook-level progress methods
  setTotalGuidebooks: (totalGuidebooks) => {
    return set({ totalGuidebooks: Math.max(0, totalGuidebooks || 0) });
  },
  setCompletedGuidebooks: (completedGuidebooks) => set({ completedGuidebooks: Math.max(0, completedGuidebooks || 0) }),
  incrementCompletedGuidebooks: () => set((state) => {
    const newCompletedGuidebooks = Math.min(state.completedGuidebooks + 1, state.totalGuidebooks);
    const rawProgress = state.totalGuidebooks > 0 ? (newCompletedGuidebooks / state.totalGuidebooks * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedGuidebooks: newCompletedGuidebooks,
      wholeProgress: boundedProgress
    };
  }),
  updateGuidebookProgress: (completedGuidebooks, totalGuidebooks) => set(() => {
    const validTotalGuidebooks = Math.max(1, totalGuidebooks || 1);
    const validCompletedGuidebooks = Math.max(0, Math.min(completedGuidebooks || 0, validTotalGuidebooks));
    const rawProgress = (validCompletedGuidebooks / validTotalGuidebooks) * 100;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedGuidebooks: validCompletedGuidebooks,
      totalGuidebooks: validTotalGuidebooks,
      wholeProgress: boundedProgress
    };
  }),
  // Custom files-level progress methods
  setTotalCustomFiles: (totalCustomFiles) => {
    return set({ totalCustomFiles: Math.max(0, totalCustomFiles || 0) });
  },
  setCompletedCustomFiles: (completedCustomFiles) => set({ completedCustomFiles: Math.max(0, completedCustomFiles || 0) }),
  incrementCompletedCustomFiles: () => set((state) => {
    const newCompletedCustomFiles = Math.min(state.completedCustomFiles + 1, state.totalCustomFiles);
    const rawProgress = state.totalCustomFiles > 0 ? (newCompletedCustomFiles / state.totalCustomFiles * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedCustomFiles: newCompletedCustomFiles,
      wholeProgress: boundedProgress
    };
  }),
  updateCustomFilesProgress: (completedCustomFiles, totalCustomFiles) => set(() => {
    const validTotalCustomFiles = Math.max(1, totalCustomFiles || 1);
    const validCompletedCustomFiles = Math.max(0, Math.min(completedCustomFiles || 0, validTotalCustomFiles));
    const rawProgress = (validCompletedCustomFiles / validTotalCustomFiles) * 100;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    return {
      completedCustomFiles: validCompletedCustomFiles,
      totalCustomFiles: validTotalCustomFiles,
      wholeProgress: boundedProgress
    };
  }),
  setCurrentJobId: (jobId) => set({ currentJobId: jobId }),
  
  // Translation results
  translationResults: [],
  historicalResults: [],
  addTranslationResult: (result) => 
    set((state) => ({ 
      translationResults: [...state.translationResults, result] 
    })),
  clearTranslationResults: () => set({ translationResults: [] }),
  saveResultsToHistory: () => set((state) => ({
    historicalResults: [...state.historicalResults, ...state.translationResults]
  })),
  clearHistoricalResults: () => set({ historicalResults: [] }),
  
  // Errors
  error: null,
  setError: (error) => set({ error }),
  
  // UI state
  isLogDialogOpen: false,
  setLogDialogOpen: (isOpen) => set({ isLogDialogOpen: isOpen }),
  isCompletionDialogOpen: false,
  setCompletionDialogOpen: (isOpen) => set({ isCompletionDialogOpen: isOpen }),
  
  // Scanning state
  isScanning: false,
  setScanning: (isScanning) => set({ isScanning }),
  
  // Scan progress state
  scanProgress: {
    currentFile: '',
    processedCount: 0,
    totalCount: undefined,
    scanType: undefined,
  },
  setScanProgress: (progress) => set((state) => ({
    scanProgress: { ...state.scanProgress, ...progress }
  })),
  resetScanProgress: () => set({
    scanProgress: {
      currentFile: '',
      processedCount: 0,
      totalCount: undefined,
      scanType: undefined,
    }
  }),
  
  // Reset translation state for new translation workflow
  resetTranslationState: () => set({
    isTranslating: false,
    progress: 0,
    wholeProgress: 0,
    totalChunks: 0,
    completedChunks: 0,
    totalMods: 0,
    completedMods: 0,
    totalQuests: 0,
    completedQuests: 0,
    totalGuidebooks: 0,
    completedGuidebooks: 0,
    totalCustomFiles: 0,
    completedCustomFiles: 0,
    currentJobId: null,
    translationResults: [],
    error: null,
    isCompletionDialogOpen: false
  }),
}));
