# Scroll Utilities and Hooks

This directory contains reusable scroll-related utilities and hooks that can be used across the application to implement consistent auto-scroll behavior in dialogs and other scrollable components.

## Available Utilities

### 1. `useAutoScroll` Hook

A React hook that provides auto-scroll functionality with user interaction detection.

```typescript
import { useAutoScroll } from '@/hooks/use-auto-scroll';

function MyComponent() {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    isAutoScrollActive,
    isUserInteracting,
    scrollHandlers,
    scrollToBottom,
    toggleAutoScroll,
    enableAutoScroll,
    disableAutoScroll
  } = useAutoScroll(scrollRef, {
    enabled: true,
    interactionDelay: 2000,
    smooth: false,
    dependencies: [logs] // Auto-scroll when logs change
  });

  return (
    <div>
      <ScrollArea ref={scrollRef} {...scrollHandlers}>
        {/* Content */}
      </ScrollArea>
      
      <label>
        <input
          type="checkbox"
          checked={isAutoScrollActive}
          onChange={toggleAutoScroll}
        />
        Auto-scroll
      </label>
    </div>
  );
}
```

### 2. `AutoScrollArea` Component

A pre-built ScrollArea component with integrated auto-scroll functionality and controls.

```typescript
import { AutoScrollArea } from '@/components/ui/auto-scroll-area';

function MyDialog() {
  return (
    <AutoScrollArea
      autoScroll={true}
      showControls={true}
      controlLabel="Auto-scroll"
      controlPosition="bottom-right"
      interactionDelay={2000}
      scrollDependencies={[logs]}
      onAutoScrollChange={(enabled) => console.log('Auto-scroll:', enabled)}
      className="h-[400px]"
    >
      {/* Scrollable content */}
    </AutoScrollArea>
  );
}
```

### 3. Scroll Utility Functions

Located in `/lib/utils/scroll.ts`, these functions provide common scroll operations:

- `scrollIntoView(element, options)` - Smoothly scrolls an element into view
- `scrollToBottom(container, smooth)` - Scrolls to the bottom of a container
- `scrollToTop(container, smooth)` - Scrolls to the top of a container
- `isScrolledToBottom(container, threshold)` - Checks if scrolled to bottom
- `isScrolledToTop(container, threshold)` - Checks if scrolled to top
- `getScrollPercentage(container)` - Gets the scroll percentage
- `scrollToPercentage(container, percentage, smooth)` - Scrolls to a specific percentage
- `preserveScrollPosition(container, updateFn)` - Preserves scroll position during updates
- `createScrollRestoration()` - Creates a scroll restoration handler for dialogs

## Implementation Examples

### Example 1: Log Dialog with Auto-Scroll

```typescript
import { useAutoScroll } from '@/hooks/use-auto-scroll';

export function LogDialog({ open, onOpenChange }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const { isAutoScrollActive, scrollHandlers, toggleAutoScroll } = useAutoScroll(scrollRef, {
    enabled: true,
    dependencies: [logs]
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ScrollArea ref={scrollRef} {...scrollHandlers}>
          {logs.map(log => <LogEntry key={log.id} {...log} />)}
        </ScrollArea>
        
        <DialogFooter>
          <Checkbox
            checked={isAutoScrollActive}
            onCheckedChange={toggleAutoScroll}
          />
          <label>Auto-scroll</label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Example 2: History Dialog with Scroll Restoration

```typescript
import { createScrollRestoration } from '@/lib/utils/scroll';

export function HistoryDialog({ open, onOpenChange }) {
  const scrollRestoration = useMemo(() => createScrollRestoration(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Save scroll position when dialog closes
  useEffect(() => {
    if (!open && scrollRef.current) {
      scrollRestoration.save(scrollRef.current);
    }
  }, [open]);
  
  // Restore scroll position when dialog opens
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRestoration.restore(scrollRef.current);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollArea ref={scrollRef}>
        {/* History content */}
      </ScrollArea>
    </Dialog>
  );
}
```

### Example 3: Using AutoScrollArea in Completion Dialog

```typescript
import { AutoScrollArea } from '@/components/ui/auto-scroll-area';

export function CompletionDialog({ results }) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Translation Complete</DialogTitle>
        </DialogHeader>
        
        <AutoScrollArea
          className="h-[400px]"
          autoScroll={true}
          showControls={true}
          controlPosition="top-right"
          scrollDependencies={[results]}
        >
          {results.map(result => (
            <ResultItem key={result.id} {...result} />
          ))}
        </AutoScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

## Best Practices

1. **User Interaction Detection**: Always respect user interactions. The auto-scroll should pause when users are actively scrolling.

2. **Performance**: Use `dependencies` array wisely to avoid unnecessary re-renders and scroll operations.

3. **Accessibility**: Provide visible controls for users to toggle auto-scroll behavior.

4. **Smooth Scrolling**: Use smooth scrolling sparingly as it can be disorienting for some users, especially with frequent updates.

5. **Dialog Scroll Restoration**: For dialogs that can be reopened, consider implementing scroll position restoration for better UX.

## Migration Guide

To migrate existing components to use these utilities:

1. Replace manual scroll handling with `useAutoScroll` hook
2. Remove redundant state management for user interaction detection
3. Use `AutoScrollArea` for simpler implementations
4. Consolidate scroll-related logic using the utility functions

Example migration:

```typescript
// Before
const [autoScroll, setAutoScroll] = useState(true);
const [userInteracting, setUserInteracting] = useState(false);
const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handleUserScroll = () => {
  setUserInteracting(true);
  if (interactionTimeoutRef.current) {
    clearTimeout(interactionTimeoutRef.current);
  }
  interactionTimeoutRef.current = setTimeout(() => {
    setUserInteracting(false);
  }, 2000);
};

useEffect(() => {
  if (autoScroll && !userInteracting && scrollAreaRef.current) {
    const scrollArea = scrollAreaRef.current;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }
}, [logs, autoScroll, userInteracting]);

// After
const { isAutoScrollActive, scrollHandlers, toggleAutoScroll } = useAutoScroll(scrollRef, {
  enabled: true,
  dependencies: [logs]
});
```