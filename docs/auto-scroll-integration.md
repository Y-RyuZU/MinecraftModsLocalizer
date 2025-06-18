# Auto-Scroll Integration Guide

This guide explains how to integrate the new auto-scroll utilities into existing dialogs in the MinecraftModsLocalizer application.

## Quick Integration Steps

### 1. For Simple Dialogs (e.g., History Dialog)

Replace the existing ScrollArea with AutoScrollArea:

```typescript
// Before
<ScrollArea className="h-[400px] border rounded-md p-4">
  {/* content */}
</ScrollArea>

// After
import { AutoScrollArea } from '@/components/ui/auto-scroll-area';

<AutoScrollArea 
  className="h-[400px] border rounded-md p-4"
  autoScroll={true}
  showControls={false} // Hide controls if not needed
  scrollDependencies={[historicalResults]}
>
  {/* content */}
</AutoScrollArea>
```

### 2. For Complex Dialogs (e.g., Log Dialog)

Use the `useAutoScroll` hook for more control:

```typescript
import { useAutoScroll } from '@/hooks/use-auto-scroll';

function LogDialog({ open, onOpenChange }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Replace manual scroll handling with the hook
  const {
    isAutoScrollActive,
    scrollHandlers,
    toggleAutoScroll
  } = useAutoScroll(scrollRef, {
    enabled: true,
    interactionDelay: 2000,
    dependencies: [logs]
  });

  // Remove old scroll handling code
  // Delete: const [autoScroll, setAutoScroll] = useState(true);
  // Delete: const [userInteracting, setUserInteracting] = useState(false);
  // Delete: const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Delete: handleUserScroll function
  // Delete: manual scroll useEffect

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ScrollArea 
          ref={scrollRef}
          className="border rounded-md"
          style={{ height: '400px' }}
          {...scrollHandlers} // Spread the handlers
        >
          {/* Log content */}
        </ScrollArea>
        
        <DialogFooter>
          <Checkbox
            checked={isAutoScrollActive}
            onChange={toggleAutoScroll}
          />
          <label>Auto-scroll</label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. For Completion Dialog

The completion dialog can benefit from auto-scroll to show new results as they come in:

```typescript
import { AutoScrollArea } from '@/components/ui/auto-scroll-area';

export function CompletionDialog({ results, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Translation Results</DialogTitle>
        </DialogHeader>
        
        <AutoScrollArea
          className="max-h-[400px]"
          autoScroll={true}
          showControls={true}
          controlPosition="top-right"
          controlLabel="Auto-scroll"
          scrollDependencies={[results]}
        >
          <div className="space-y-2 p-4">
            {results.map((result, index) => (
              <ResultItem key={index} result={result} />
            ))}
          </div>
        </AutoScrollArea>
        
        <DialogFooter>
          {/* Footer content */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Benefits of This Approach

1. **Consistency**: All dialogs use the same auto-scroll behavior
2. **Reusability**: The hook and components can be used anywhere
3. **User Control**: Users can easily toggle auto-scroll on/off
4. **Performance**: Optimized scroll handling with proper cleanup
5. **Accessibility**: Clear visual indicators and keyboard support

## Advanced Usage

### Custom Scroll Behavior

```typescript
import { scrollToBottom, isScrolledToBottom } from '@/lib/utils/scroll';

// Scroll to bottom only if already near bottom
if (isScrolledToBottom(scrollRef.current, 100)) {
  scrollToBottom(scrollRef.current, true);
}
```

### Scroll Position Restoration

```typescript
import { createScrollRestoration } from '@/lib/utils/scroll';

const scrollRestore = createScrollRestoration();

// Before closing dialog
scrollRestore.save(scrollRef.current);

// When reopening dialog
scrollRestore.restore(scrollRef.current);
```

### Conditional Auto-Scroll

```typescript
const { enableAutoScroll, disableAutoScroll } = useAutoScroll(scrollRef, {
  enabled: false, // Start disabled
  dependencies: [logs]
});

// Enable auto-scroll when translation starts
useEffect(() => {
  if (isTranslating) {
    enableAutoScroll();
  } else {
    disableAutoScroll();
  }
}, [isTranslating]);
```

## Testing

To test the auto-scroll implementation:

1. Open a dialog with scrollable content
2. Verify auto-scroll works when new content is added
3. Scroll manually and verify auto-scroll pauses
4. Wait 2 seconds and verify auto-scroll resumes
5. Toggle the auto-scroll checkbox and verify behavior changes
6. Test keyboard navigation and accessibility

## Migration Checklist

- [ ] Replace manual scroll state management with `useAutoScroll` hook
- [ ] Remove redundant user interaction detection code
- [ ] Add scroll handlers to ScrollArea components
- [ ] Update auto-scroll toggle controls to use hook methods
- [ ] Test scroll behavior in all scenarios
- [ ] Verify accessibility with keyboard navigation
- [ ] Update any scroll-related unit tests