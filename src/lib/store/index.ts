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
  currentJobId: string | null;
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setWholeProgress: (progress: number) => void;
  setTotalChunks: (totalChunks: number) => void;
  setCompletedChunks: (completedChunks: number) => void;
  incrementCompletedChunks: () => void;
  setCurrentJobId: (jobId: string | null) => void;
  
  // Translation results
  translationResults: TranslationResult[];
  addTranslationResult: (result: TranslationResult) => void;
  clearTranslationResults: () => void;
  
  // Errors
  error: string | null;
  setError: (error: string | null) => void;
  
  // UI state
  isLogDialogOpen: boolean;
  setLogDialogOpen: (isOpen: boolean) => void;
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
  currentJobId: null,
  setTranslating: (isTranslating) => set({ isTranslating }),
  setProgress: (progress) => set({ progress }),
  setWholeProgress: (progress) => set({ wholeProgress: progress }),
  setTotalChunks: (totalChunks) => set({ totalChunks }),
  setCompletedChunks: (completedChunks) => set({ completedChunks }),
  incrementCompletedChunks: () => set((state) => ({ 
    completedChunks: state.completedChunks + 1,
    wholeProgress: state.totalChunks > 0 ? Math.round((state.completedChunks + 1) / state.totalChunks * 100) : 0
  })),
  setCurrentJobId: (jobId) => set({ currentJobId: jobId }),
  
  // Translation results
  translationResults: [],
  addTranslationResult: (result) => 
    set((state) => ({ 
      translationResults: [...state.translationResults, result] 
    })),
  clearTranslationResults: () => set({ translationResults: [] }),
  
  // Errors
  error: null,
  setError: (error) => set({ error }),
  
  // UI state
  isLogDialogOpen: false,
  setLogDialogOpen: (isOpen) => set({ isLogDialogOpen: isOpen }),
}));
