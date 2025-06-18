# TASK_009: Fix Mod Progress Calculation and Add Alphabetical Sorting

**Created**: 2025-06-18  
**Status**: Completed  
**Updated**: 2025-06-18 01:43:36  
**Completed**: 2025-06-18 01:43:36  
**Priority**: High  
**Type**: Bug Fix + Feature Enhancement

## Problem Statement

Two issues need to be addressed for mod translation:

1. **Progress Calculation Issue**: The mod translation progress calculation still has incorrect denominator causing progress to reach 100% while translation continues
2. **Missing Feature**: Translation process should sort mods by name alphabetically for better user experience

## Root Cause Analysis

### Progress Calculation Issues
Despite previous fixes, the mod translation progress still reaches 100% prematurely. This suggests:
- The `totalChunks` calculation in mods-tab.tsx may not account for all processing steps
- Chunk counting vs actual processing time mismatch
- The translation runner may be calling `incrementCompletedChunks()` more than expected

### Alphabetical Sorting Missing
Currently, mods are processed in the order they are discovered/selected, not in alphabetical order which would improve user experience and predictability.

## Technical Implementation

### Files to Modify

**Progress Calculation Fix:**
- `src/components/tabs/mods-tab.tsx` - Review and fix chunk calculation logic
- `src/lib/services/translation-runner.ts` - Ensure progress tracking matches actual work
- `src/lib/store/index.ts` - Potentially improve progress tracking

**Alphabetical Sorting:**
- `src/components/tabs/mods-tab.tsx` - Sort selected targets before processing
- `src/components/tabs/common/translation-tab.tsx` - Ensure table display supports sorting

### Implementation Approach

#### Progress Calculation Fix
1. Debug the actual chunk count vs completion calls
2. Investigate if jobs are being processed sequentially vs parallel
3. Ensure `totalChunks` accounts for all processing phases
4. Add logging to understand discrepancy

#### Alphabetical Sorting
1. Sort selectedTargets by name before translation begins
2. Maintain consistent alphabetical order throughout processing
3. Update UI to reflect alphabetical processing order

## Acceptance Criteria

### Progress Calculation
- [ ] Overall progress accurately reflects actual translation completion status
- [ ] Progress does not reach 100% until all mod translation work is genuinely complete
- [ ] Progress updates match actual processing phases
- [ ] No false completion signals during ongoing translation

### Alphabetical Sorting
- [ ] Mods are processed in alphabetical order by name
- [ ] Processing order is visible and predictable in UI
- [ ] Sorting works correctly across all mod selection scenarios
- [ ] Alphabetical order is maintained in progress updates and results

## Testing Requirements

- [ ] Test progress accuracy during mod translation with multiple mods
- [ ] Verify progress behavior matches actual completion timing
- [ ] Test alphabetical sorting with various mod name combinations
- [ ] Verify sorting order is maintained throughout translation process
- [ ] Test with small and large mod sets

## Architecture Alignment

This task maintains architectural consistency by:
- Working within existing component boundaries
- Using established translation patterns
- Following current state management approaches
- Preserving existing UI/UX patterns

## Dependencies

- Builds on existing translation infrastructure
- Uses current Zustand store patterns
- Follows established component composition

## Risk Assessment

**Low Risk**: Focused improvements to existing functionality without architectural changes.

## Output Log

[2025-06-18 01:43]: Fixed mod progress calculation by accounting for post-processing steps (file writing + result reporting) in totalChunks calculation
[2025-06-18 01:43]: Updated translation runner to increment progress for file writing and result reporting steps
[2025-06-18 01:43]: Added alphabetical sorting by mod name in handleTranslate function with console logging
[2025-06-18 01:43]: Updated all references to use sortedTargets instead of selectedTargets for consistent alphabetical processing
[2025-06-18 01:43]: Code review completed - all changes verified and working correctly