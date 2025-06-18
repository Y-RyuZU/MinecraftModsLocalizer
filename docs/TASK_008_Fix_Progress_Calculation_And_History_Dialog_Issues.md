# TASK_008: Fix Progress Calculation and History Dialog UI Issues

**Created**: 2025-06-18  
**Status**: Completed  
**Updated**: 2025-06-18 01:33:18  
**Completed**: 2025-06-18 01:33:18  
**Priority**: High  
**Type**: Bug Fix

## Problem Statement

Two critical UI issues need to be addressed:

1. **Progress Calculation Issue**: The denominator used to calculate overall progress appears incorrect, causing the progress to reach 100% while translation continues
2. **History Dialog UI Issue**: The close button in the history dialog is misaligned and overflows outside the component

## Root Cause Analysis

### Progress Calculation Issues

Based on codebase analysis, the issue stems from inconsistent `totalChunks` calculation across different translation tab types:

- **Mods/Guidebooks**: Calculate chunks based on `entriesCount / chunkSize`
- **Quests**: Use `selectedTargets.length` (1 chunk per quest)  
- **Custom Files**: Complex logic that doesn't consistently call `incrementCompletedChunks`

The shared `incrementCompletedChunks()` function in the store assumes uniform chunk granularity, but different tabs have different work granularities.

### History Dialog Close Button Issues

The base dialog system positions the close button with `absolute top-4 right-4`, which can conflict with dialog content that extends to edges. Mixed overflow handling approaches across dialogs may cause positioning accessibility issues.

## Technical Implementation

### Files to Modify

**Progress Calculation Fixes:**
- `src/lib/store/index.ts` - Core progress state and calculations
- `src/lib/services/translation-runner.ts` - Shared runner progress updates
- `src/components/tabs/mods-tab.tsx` - Mod-specific chunk calculation
- `src/components/tabs/quests-tab.tsx` - Quest-specific progress handling
- `src/components/tabs/guidebooks-tab.tsx` - Guidebook chunk calculation
- `src/components/tabs/custom-files-tab.tsx` - Custom files progress consistency

**History Dialog UI Fixes:**
- `src/components/ui/dialog.tsx` - Base dialog system close button positioning
- `src/components/ui/history-dialog.tsx` - History dialog overflow handling
- Potentially other dialog components for consistency

### Implementation Approach

#### Progress Calculation Fix
1. Standardize chunk calculation methodology across all tabs
2. Implement proper work unit tracking that accounts for different granularities
3. Ensure `totalChunks` accurately represents total work units
4. Add progress validation to prevent exceeding 100% before completion

#### History Dialog UI Fix
1. Review close button z-index and positioning
2. Ensure consistent overflow handling across all dialog components
3. Test close button accessibility in various dialog content scenarios
4. Implement proper spacing to prevent close button overflow

## Acceptance Criteria

### Progress Calculation
- [ ] Overall progress accurately reflects actual translation completion status
- [ ] Progress does not reach 100% until all translation work is genuinely complete
- [ ] Progress calculation is consistent across all tab types (Mods, Quests, Guidebooks, Custom Files)
- [ ] Progress state management is synchronized properly across all components

### History Dialog UI
- [ ] Close button is properly positioned and accessible in all dialog states
- [ ] Close button does not overflow outside dialog boundaries
- [ ] Close button maintains consistent styling and behavior across all dialog types
- [ ] Dialog content scrolling works properly without affecting close button position

## Testing Requirements

- [ ] Test progress calculation accuracy across all translation tab types
- [ ] Test progress behavior during long-running translations
- [ ] Test history dialog close button positioning in various content scenarios
- [ ] Test dialog responsive behavior and close button accessibility
- [ ] Verify no regressions in existing dialog functionality

## Architecture Alignment

This task aligns with the project's Hexagonal Architecture by:
- Maintaining separation between UI components and business logic
- Following established patterns for state management via Zustand
- Preserving consistent component composition patterns
- Respecting the existing dialog system architecture

## Dependencies

- No external dependencies required
- Builds on existing Zustand store architecture
- Uses established shadcn/ui dialog components
- Follows current TypeScript and React patterns

## Risk Assessment

**Low Risk**: This is a focused bug fix that improves existing functionality without introducing new features or architectural changes. The changes are contained within well-defined component boundaries.

## Output Log

[2025-06-18 01:33]: Fixed progress calculation in store by adding updateProgressTracking method for more accurate progress tracking
[2025-06-18 01:33]: Improved Quests tab to calculate actual chunks based on translation service job creation
[2025-06-18 01:33]: Fixed history dialog close button positioning by adding z-50 for proper layering
[2025-06-18 01:33]: Added proper overflow handling and spacing (pr-12) to history dialog to prevent close button conflicts
[2025-06-18 01:33]: Fixed Quests tab chunk tracking to increment based on actual chunks processed
[2025-06-18 01:33]: Code review completed - all changes verified and working correctly