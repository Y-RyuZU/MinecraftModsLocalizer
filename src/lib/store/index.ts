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
  
  // Translation targets
  translationTargets: TranslationTarget[];
  setTranslationTargets: (targets: TranslationTarget[]) => void;
  updateTranslationTarget: (id: string, selected: boolean) => void;
  
  // Translation progress
  isTranslating: boolean;
  progress: number;
  currentJobId: string | null;
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setCurrentJobId: (jobId: string | null) => void;
  
  // Translation results
  translationResults: TranslationResult[];
  addTranslationResult: (result: TranslationResult) => void;
  clearTranslationResults: () => void;
  
  // Errors
  error: string | null;
  setError: (error: string | null) => void;
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
  
  // Translation targets
  translationTargets: [],
  setTranslationTargets: (targets) => set({ translationTargets: targets }),
  updateTranslationTarget: (id, selected) => 
    set((state) => ({
      translationTargets: state.translationTargets.map((target) => 
        target.id === id ? { ...target, selected } : target
      )
    })),
  
  // Translation progress
  isTranslating: false,
  progress: 0,
  currentJobId: null,
  setTranslating: (isTranslating) => set({ isTranslating }),
  setProgress: (progress) => set({ progress }),
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
}));
