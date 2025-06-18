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
  currentJobId: null,
  setTranslating: (isTranslating) => set({ isTranslating }),
  setProgress: (progress) => set({ progress: Math.max(0, Math.min(100, progress || 0)) }),
  setWholeProgress: (progress) => set({ wholeProgress: Math.max(0, Math.min(100, progress || 0)) }),
  setTotalChunks: (totalChunks) => {
    console.log(`Setting totalChunks to: ${totalChunks}`);
    return set({ totalChunks: Math.max(0, totalChunks || 0) });
  },
  setCompletedChunks: (completedChunks) => set({ completedChunks: Math.max(0, completedChunks || 0) }),
  incrementCompletedChunks: () => set((state) => {
    // Prevent exceeding totalChunks
    const newCompletedChunks = Math.min(state.completedChunks + 1, state.totalChunks);
    // Calculate progress with bounds checking (0-100)
    const rawProgress = state.totalChunks > 0 ? (newCompletedChunks / state.totalChunks * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    console.log(`Progress tracking: ${newCompletedChunks}/${state.totalChunks} chunks (${boundedProgress}%)`);
    
    return {
      completedChunks: newCompletedChunks,
      wholeProgress: boundedProgress
    };
  }),
  updateProgressTracking: (completedChunks, totalChunks) => set(() => {
    // Validate inputs
    const validTotalChunks = Math.max(1, totalChunks || 1);
    const validCompletedChunks = Math.max(0, Math.min(completedChunks || 0, validTotalChunks));
    
    // Calculate progress with bounds checking (0-100)
    const rawProgress = (validCompletedChunks / validTotalChunks) * 100;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    console.log(`Updated progress tracking: ${validCompletedChunks}/${validTotalChunks} chunks (${boundedProgress}%)`);
    
    return {
      completedChunks: validCompletedChunks,
      totalChunks: validTotalChunks,
      wholeProgress: boundedProgress
    };
  }),
  // Mod-level progress methods
  setTotalMods: (totalMods) => {
    console.log(`Setting totalMods to: ${totalMods}`);
    return set({ totalMods: Math.max(0, totalMods || 0) });
  },
  setCompletedMods: (completedMods) => set({ completedMods: Math.max(0, completedMods || 0) }),
  incrementCompletedMods: () => set((state) => {
    // Prevent exceeding totalMods
    const newCompletedMods = Math.min(state.completedMods + 1, state.totalMods);
    // Calculate progress with bounds checking (0-100)
    const rawProgress = state.totalMods > 0 ? (newCompletedMods / state.totalMods * 100) : 0;
    const boundedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    
    console.log(`Mod progress tracking: ${newCompletedMods}/${state.totalMods} mods (${boundedProgress}%)`);
    
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
    
    console.log(`Updated mod progress tracking: ${validCompletedMods}/${validTotalMods} mods (${boundedProgress}%)`);
    
    return {
      completedMods: validCompletedMods,
      totalMods: validTotalMods,
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
  
  // Reset translation state for new translation workflow
  resetTranslationState: () => set({
    isTranslating: false,
    progress: 0,
    wholeProgress: 0,
    totalChunks: 0,
    completedChunks: 0,
    totalMods: 0,
    completedMods: 0,
    currentJobId: null,
    translationResults: [],
    error: null,
    isCompletionDialogOpen: false
  }),
}));
