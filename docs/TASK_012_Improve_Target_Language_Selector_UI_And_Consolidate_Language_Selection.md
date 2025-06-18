# TASK_012: Improve Target Language Selector UI And Consolidate Language Selection

**Status**: Active  
**Priority**: Medium  
**Type**: UI/UX Enhancement  
**Created**: 2025-06-18 04:00:32  
**Assignee**: Unassigned  

## Summary

Fix the target language selector alignment issues, remove unnecessary description text, enhance error messaging with context, and consolidate language selection by removing the "Temporary" prefix throughout the application.

## Problem Statement

1. **Alignment Issue**: The TemporaryTargetLanguageSelector component is positioned slightly lower than other elements in the same row, creating visual misalignment.

2. **Description Text**: The selector has unnecessary description text below it that should be removed for cleaner UI.

3. **Error Context**: The error message for no target language selected lacks context about where to configure the target language.

4. **Naming Confusion**: The "Temporary" prefix in component names and UI labels creates unnecessary distinction when the functionality should be unified.

## Requirements

### Functional Requirements
- Fix vertical alignment of the target language selector to match other elements in the row
- Remove description text below the selector
- Add context to the noTargetLanguageSelected error message
- Remove "Temporary" prefix from all related components and labels

### Non-Functional Requirements
- Maintain existing functionality of language selection
- Ensure consistent UI appearance across all tabs
- Preserve translation key structure for i18n

## Technical Context

### Current Implementation

1. **Component Location**: `/src/components/tabs/temporary-target-language-selector.tsx`
   - Used in translation tabs at lines 372-384 of `/src/components/tabs/common/translation-tab.tsx`
   - Wrapped in a `div` with `min-w-[200px]` class

2. **Component Structure**:
   ```tsx
   <div className="flex flex-col space-y-1.5">
     <Label htmlFor={selectId}>{translatedLabel}</Label>
     <Select>...</Select>
   </div>
   ```

3. **Error Handling**: At line 254 of translation-tab.tsx:
   ```typescript
   setError(t('errors.noTargetLanguageSelected') || "No target language selected");
   ```

4. **Translation Keys**:
   - `tabs.temporaryTargetLanguage` - Component label
   - `tabs.selectTemporaryLanguage` - Select placeholder
   - `tabs.temporary` - Temporary indicator in dropdown
   - `errors.noTargetLanguageSelected` - Error message

### Settings Panel Integration

The settings panel at `/src/components/settings/translation-settings.tsx` manages the global target language configuration through a dialog (TargetLanguageDialog).

## Implementation Guide

### 1. Fix Alignment Issue

**In `/src/components/tabs/temporary-target-language-selector.tsx`**:
- Change the root div from `flex flex-col space-y-1.5` to inline alignment
- Remove the Label component to match other inline elements
- Update the Select component to include label as placeholder

**In `/src/components/tabs/common/translation-tab.tsx`** (line 371):
- Adjust the wrapper div classes if needed to ensure proper alignment

### 2. Remove Description Text

The component doesn't appear to have explicit description text in the current implementation. Verify if any description is being added through CSS or parent components.

### 3. Enhance Error Message

**In `/src/components/tabs/common/translation-tab.tsx`** (line 254):
```typescript
setError(t('errors.noTargetLanguageSelected') || "No target language selected. Please configure it in Settings > Translation Settings.");
```

Update the translation key to include context about where to configure the target language.

### 4. Remove "Temporary" Prefix

**Files to update**:
1. Rename component file: `temporary-target-language-selector.tsx` → `target-language-selector.tsx`
2. Update component name: `TemporaryTargetLanguageSelector` → `TargetLanguageSelector`
3. Update imports in `translation-tab.tsx`
4. Update translation keys:
   - `tabs.temporaryTargetLanguage` → `tabs.targetLanguage`
   - `tabs.selectTemporaryLanguage` → `tabs.selectLanguage`
   - Remove `tabs.temporary` indicator or change to `tabs.current`

**Consider**: Whether to merge this functionality with the settings panel target language selector for complete consolidation.

## Success Criteria

1. Target language selector aligns properly with other elements in the translation tab toolbar
2. No description text appears below the selector
3. Error message provides clear guidance on where to configure target language
4. All "Temporary" references are removed from code and UI
5. Existing functionality remains intact
6. All translation tabs (mods, quests, guidebooks) display consistent UI

## Testing Requirements

1. Visual inspection of alignment in all translation tabs
2. Verify error message appears with proper context when no language is selected
3. Test language selection and persistence across tabs
4. Ensure translation process uses selected language correctly
5. Verify all UI text uses updated labels without "Temporary"

## Related Components

- `/src/components/tabs/common/translation-tab.tsx`
- `/src/components/tabs/temporary-target-language-selector.tsx`
- `/src/components/settings/translation-settings.tsx`
- `/src/lib/i18n/locales/[lang]/common.json` (translation files)

## Notes

- The component uses a combination of global and local state for language selection
- The effective language is determined by: `selectedLanguage ?? globalLanguage`
- Consider if complete consolidation with settings panel is desired in future iterations