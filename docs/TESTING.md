# Translation Process Testing Documentation

## Overview

This document describes the comprehensive test suite created for the Minecraft Mods Localizer translation process, with special focus on progress bar functionality and mock data testing.

## Test Structure

### 🧪 **Testing Infrastructure**

- **Framework**: Jest with Next.js integration
- **Testing Library**: React Testing Library for UI components
- **Mock Strategy**: Comprehensive mocking of Tauri APIs, LLM adapters, and file operations
- **Coverage**: Unit tests, integration tests, and UI component tests

### 📁 **Test Files Created**

#### 1. **Test Infrastructure**
- `jest.config.js` - Jest configuration with Next.js integration
- `jest.setup.js` - Global test setup with mocks for Tauri, Next.js, and browser APIs
- `package.json` - Updated with Jest dependencies and test scripts

#### 2. **Mock Data and Utilities**
- `src/lib/test-utils/mock-data.ts` - Comprehensive mock data for all translation types

#### 3. **Service Layer Tests**
- `src/lib/services/__tests__/translation-service.test.ts` - Core translation service testing
- `src/lib/services/__tests__/translation-runner.test.ts` - Translation job runner testing

#### 4. **Store and State Management Tests**
- `src/lib/store/__tests__/progress-store.test.ts` - Progress tracking state management

#### 5. **Integration Tests**
- `src/lib/__tests__/translation-integration.test.ts` - End-to-end translation workflow

#### 6. **UI Component Tests**
- `src/components/ui/__tests__/progress.test.tsx` - Progress bar component testing
- `src/components/tabs/common/__tests__/translation-tab-progress.test.tsx` - Translation tab progress testing

## 🎯 **Test Coverage Areas**

### **Translation Service Testing**
- ✅ Job creation and management
- ✅ Multi-chunk translation handling
- ✅ Progress tracking callbacks
- ✅ Error handling and retries
- ✅ Job interruption
- ✅ Content validation
- ✅ Logging integration

### **Translation Runner Testing**
- ✅ Single and multiple job processing
- ✅ Chunk-level progress tracking
- ✅ Error handling and recovery
- ✅ Job interruption mid-process
- ✅ Output writing and result generation

### **Progress Bar Testing**
- ✅ Progress state management (chunk-level and mod-level)
- ✅ Bounds checking (0-100%)
- ✅ UI component rendering
- ✅ Accessibility (ARIA attributes)
- ✅ Real-time progress updates
- ✅ Edge case handling

### **Mock Data Coverage**
- ✅ **Mod Files**: Simple, complex (150+ items), and special character mods
- ✅ **Quest Files**: Simple and complex quest chains
- ✅ **Guidebook Files**: Basic and advanced Patchouli books
- ✅ **Translation Results**: Multi-language mock translations
- ✅ **Error Scenarios**: Network, API key, parsing, timeout, and rate limit errors

## 🔧 **Running Tests**

### **Available Scripts**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### **Test Execution**
```bash
# Install dependencies (includes test dependencies)
bun install

# Run the full test suite
bun test

# Run specific test files
bun test translation-service
bun test progress-store
bun test translation-integration
```

## 📊 **Test Scenarios**

### **Progress Bar Functionality Tests**

#### **Basic Progress Management**
- ✅ Initialization with default values (0%)
- ✅ Progress value bounds checking (0-100%)
- ✅ Null/undefined value handling
- ✅ Translation state management

#### **Chunk-Level Progress Tracking**
- ✅ Total chunks setting with validation
- ✅ Incremental chunk completion
- ✅ Progress percentage calculation
- ✅ Bounds prevention (can't exceed total chunks)

#### **Mod-Level Progress Tracking**
- ✅ Total mods setting with validation
- ✅ Incremental mod completion
- ✅ Progress percentage calculation
- ✅ Bounds prevention (can't exceed total mods)

#### **Real-World Progress Scenarios**
- ✅ Mod translation simulation (3 mods: 33%, 67%, 100%)
- ✅ Quest translation simulation (50 chunks in batches)
- ✅ Mixed progress tracking (switching between chunk and mod tracking)

### **Translation Process Tests**

#### **Single File Translation**
- ✅ Simple mod with 3 translation keys
- ✅ Complex mod with 150+ translation keys
- ✅ Special characters and formatting preservation
- ✅ Progress callback execution

#### **Multi-File Translation**
- ✅ Sequential processing of multiple mods
- ✅ Progress tracking across multiple jobs
- ✅ Error isolation (one failure doesn't stop others)

#### **Error Handling**
- ✅ Network failures with retry logic
- ✅ API key configuration errors
- ✅ Response parsing errors
- ✅ Job interruption handling
- ✅ Partial failure recovery

#### **Performance Testing**
- ✅ Large file handling (500+ translation keys)
- ✅ Multiple small file processing (20 files)
- ✅ Stress testing with time constraints

## 🎨 **Mock Data Details**

### **Mod Translation Mock Data**
```typescript
// Simple mod - 3 translation keys
mockModData.simpleMod: {
  'item.simple_mod.test_item': 'Test Item',
  'block.simple_mod.test_block': 'Test Block',
  'entity.simple_mod.test_entity': 'Test Entity'
}

// Complex mod - 150 translation keys
mockModData.complexMod: {
  'item.complex_mod.item_0': 'Complex Item 0',
  // ... 149 more items
}

// Special characters mod
mockModData.specialMod: {
  'item.special_mod.formatted': '§aGreen Text §r§lBold Text',
  'item.special_mod.tooltip': 'Line 1\\nLine 2\\nLine 3',
  'item.special_mod.unicode': 'Unicode: ★ ♠ ♥ ♦ ♣'
}
```

### **Quest Translation Mock Data**
```typescript
// Simple quest
mockQuestData.simpleQuest: {
  title: "Gather Resources",
  description: "Collect 10 wood logs to start your journey"
}

// Complex quest chain
mockQuestData.complexQuest: {
  title: "Master Craftsman",
  description: "Complete a series of crafting challenges...",
  tasks: [...] // Multiple tasks with descriptions
}
```

### **Guidebook Translation Mock Data**
```typescript
// Basic guide - 5 translation keys
mockGuidebookData.simpleBook: {
  'patchouli.basic_guide.landing_text': 'Welcome to the Basic Guide!',
  // ... more guide content
}

// Advanced guide - 75+ translation keys
mockGuidebookData.advancedBook: {
  // Categories, entries, and pages with comprehensive content
}
```

## 🚀 **Integration Test Scenarios**

### **Complete Translation Session**
The integration tests simulate a real-world mod pack translation session:

1. **Setup Phase**: Configure translation service with mock LLM adapter
2. **Mod Translation**: Translate 3 different types of mods
3. **Quest Translation**: Translate quest files with chunk-level progress
4. **Guidebook Translation**: Translate Patchouli guidebooks
5. **Progress Tracking**: Verify accurate progress updates throughout
6. **Error Handling**: Test recovery from various failure scenarios
7. **Performance**: Ensure reasonable processing times

### **Progress Bar Integration**
Tests verify that the progress bar correctly reflects:
- ✅ Individual job progress (per file)
- ✅ Overall progress (across all files)
- ✅ Current file name display
- ✅ Progress updates in real-time
- ✅ Proper cleanup when translation completes

## 🔍 **Debugging and Troubleshooting**

### **Common Test Issues**
1. **Timing Issues**: Tests use proper async/await and waitFor patterns
2. **Mock Conflicts**: Each test properly resets mocks in beforeEach
3. **State Isolation**: Store state is reset between tests
4. **Memory Leaks**: Translation jobs are properly cleaned up

### **Debug Utilities**
- Console logging in progress store for debugging progress calculations
- Mock adapters with configurable delays and failure rates
- Comprehensive error scenarios for testing edge cases

## 📈 **Test Results and Coverage**

### **Expected Test Coverage**
- **Translation Service**: 100% of core functionality
- **Translation Runner**: 100% of job processing logic
- **Progress Store**: 100% of state management
- **UI Components**: 100% of progress bar functionality
- **Integration**: 95%+ of real-world scenarios

### **Performance Benchmarks**
- **Small translation job** (3 keys): < 100ms
- **Large translation job** (500 keys): < 5 seconds
- **Multiple jobs** (20 files): < 5 seconds total
- **Progress updates**: Real-time with no lag

## 🎯 **Quality Assurance**

This test suite ensures:
- ✅ **Reliability**: Translation process works consistently
- ✅ **Progress Accuracy**: Progress bars show correct percentages
- ✅ **Error Resilience**: Graceful handling of failures
- ✅ **Performance**: Acceptable speed for large workloads
- ✅ **User Experience**: Smooth progress updates and feedback
- ✅ **Accessibility**: Progress bars have proper ARIA attributes

## 🔮 **Future Test Enhancements**

Potential areas for additional testing:
- Visual regression testing for progress bar styling
- Load testing with extremely large translation jobs
- Network simulation with various connection speeds
- Internationalization testing for progress text
- End-to-end testing with real LLM APIs (integration environment)