import { useAppStore } from '../index';

describe('Progress Store', () => {
  beforeEach(() => {
    // Reset store state before each test by calling the methods directly
    const { getState } = useAppStore;
    const state = getState();
    state.setTranslating(false);
    state.setProgress(0);
    state.setWholeProgress(0);
    state.setTotalChunks(0);
    state.setCompletedChunks(0);
    state.setTotalMods(0);
    state.setCompletedMods(0);
    state.setCurrentJobId(null);
  });

  describe('Basic Progress Management', () => {
    it('should set progress values correctly', () => {
      const state = useAppStore.getState();
      
      state.setProgress(50);
      expect(useAppStore.getState().progress).toBe(50);

      state.setWholeProgress(75);
      expect(useAppStore.getState().wholeProgress).toBe(75);
    });

    it('should bounds-check progress values', () => {
      const state = useAppStore.getState();

      // Test over 100%
      state.setProgress(150);
      expect(useAppStore.getState().progress).toBe(100);

      // Test negative value (should not go backwards from current value)
      const currentWholeProgress = useAppStore.getState().wholeProgress;
      state.setWholeProgress(-10);
      // Should maintain current value due to backward progress prevention
      expect(useAppStore.getState().wholeProgress).toBe(currentWholeProgress);

      // Test null/undefined with backward progress prevention
      // Progress is already at 100%, so null (treated as 0) won't decrease it
      const currentProgress = useAppStore.getState().progress;
      state.setProgress(null as any);
      expect(useAppStore.getState().progress).toBe(currentProgress); // Should stay at 100%

      // Same for wholeProgress
      const currentWhole = useAppStore.getState().wholeProgress;
      state.setWholeProgress(undefined as any);
      expect(useAppStore.getState().wholeProgress).toBe(currentWhole);
    });

    it('should manage translation state', () => {
      const state = useAppStore.getState();

      state.setTranslating(true);
      expect(useAppStore.getState().isTranslating).toBe(true);

      state.setCurrentJobId('test_job_123');
      expect(useAppStore.getState().currentJobId).toBe('test_job_123');

      state.setTranslating(false);
      expect(useAppStore.getState().isTranslating).toBe(false);

      state.setCurrentJobId(null);
      expect(useAppStore.getState().currentJobId).toBeNull();
    });
  });

  describe('Chunk-Level Progress Tracking', () => {
    it('should set total chunks with bounds checking', () => {
      const state = useAppStore.getState();

      state.setTotalChunks(100);
      expect(useAppStore.getState().totalChunks).toBe(100);

      // Test negative value
      state.setTotalChunks(-5);
      expect(useAppStore.getState().totalChunks).toBe(0);

      // Test null value
      state.setTotalChunks(null as any);
      expect(useAppStore.getState().totalChunks).toBe(0);
    });

    it('should increment completed chunks correctly', () => {
      const state = useAppStore.getState();

      state.setTotalChunks(10);
      state.setCompletedChunks(0);

      state.incrementCompletedChunks();
      expect(useAppStore.getState().completedChunks).toBe(1);
      expect(useAppStore.getState().wholeProgress).toBe(10); // 1/10 * 100

      state.incrementCompletedChunks();
      state.incrementCompletedChunks();
      expect(useAppStore.getState().completedChunks).toBe(3);
      expect(useAppStore.getState().wholeProgress).toBe(30); // 3/10 * 100

      // Test bounds - shouldn't exceed totalChunks
      state.setCompletedChunks(9);
      state.incrementCompletedChunks(); // Should go to 10
      state.incrementCompletedChunks(); // Should stay at 10
      expect(useAppStore.getState().completedChunks).toBe(10);
      expect(useAppStore.getState().wholeProgress).toBe(100);
    });

    it('should update progress tracking correctly', () => {
      const state = useAppStore.getState();

      state.updateProgressTracking(7, 20);
      const currentState = useAppStore.getState();
      expect(currentState.completedChunks).toBe(7);
      expect(currentState.totalChunks).toBe(20);
      expect(currentState.wholeProgress).toBe(35); // 7/20 * 100

      // Test with completed > total
      state.updateProgressTracking(15, 10);
      const updatedState = useAppStore.getState();
      expect(updatedState.completedChunks).toBe(10); // Capped at total
      expect(updatedState.totalChunks).toBe(10);
      expect(updatedState.wholeProgress).toBe(100);
    });
  });

  describe('Mod-Level Progress Tracking', () => {
    it('should set total mods with bounds checking', () => {
      const state = useAppStore.getState();

      state.setTotalMods(5);
      expect(useAppStore.getState().totalMods).toBe(5);

      // Test negative value
      state.setTotalMods(-3);
      expect(useAppStore.getState().totalMods).toBe(0);
    });

    it('should increment completed mods correctly', () => {
      const state = useAppStore.getState();

      state.setTotalMods(4);
      state.setCompletedMods(0);

      state.incrementCompletedMods();
      expect(useAppStore.getState().completedMods).toBe(1);
      expect(useAppStore.getState().wholeProgress).toBe(25); // 1/4 * 100

      state.incrementCompletedMods();
      state.incrementCompletedMods();
      expect(useAppStore.getState().completedMods).toBe(3);
      expect(useAppStore.getState().wholeProgress).toBe(75); // 3/4 * 100

      // Test bounds
      state.incrementCompletedMods(); // Should go to 4
      state.incrementCompletedMods(); // Should stay at 4
      expect(useAppStore.getState().completedMods).toBe(4);
      expect(useAppStore.getState().wholeProgress).toBe(100);
    });

    it('should update mod progress correctly', () => {
      const state = useAppStore.getState();

      state.updateModProgress(2, 6);
      const currentState = useAppStore.getState();
      expect(currentState.completedMods).toBe(2);
      expect(currentState.totalMods).toBe(6);
      expect(currentState.wholeProgress).toBe(33); // 2/6 * 100, rounded

      state.updateModProgress(1, 1);
      const updatedState = useAppStore.getState();
      expect(updatedState.completedMods).toBe(1);
      expect(updatedState.totalMods).toBe(1);
      expect(updatedState.wholeProgress).toBe(100);
    });
  });

  describe('Progress Calculation Edge Cases', () => {
    it('should handle zero total chunks gracefully', () => {
      const state = useAppStore.getState();

      state.setTotalChunks(0);
      state.incrementCompletedChunks();
      expect(useAppStore.getState().wholeProgress).toBe(0); // Should not divide by zero
    });

    it('should handle zero total mods gracefully', () => {
      const state = useAppStore.getState();

      state.setTotalMods(0);
      state.incrementCompletedMods();
      expect(useAppStore.getState().wholeProgress).toBe(0); // Should not divide by zero
    });

    it('should round progress values correctly', () => {
      const state = useAppStore.getState();

      // Test chunk progress rounding
      state.updateProgressTracking(1, 3); // 33.333...%
      expect(useAppStore.getState().wholeProgress).toBe(33);

      state.updateProgressTracking(2, 3); // 66.666...%
      expect(useAppStore.getState().wholeProgress).toBe(67);

      // Test mod progress rounding
      state.updateModProgress(1, 7); // 14.285...%
      expect(useAppStore.getState().wholeProgress).toBe(14);

      state.updateModProgress(5, 7); // 71.428...%
      expect(useAppStore.getState().wholeProgress).toBe(71);
    });
  });
});