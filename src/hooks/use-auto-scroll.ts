import { useEffect, useRef, useState, useCallback, RefObject } from 'react';

export interface UseAutoScrollOptions {
  /**
   * Whether auto-scroll is enabled
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Delay in milliseconds before re-enabling auto-scroll after user interaction
   * @default 2000
   */
  interactionDelay?: number;
  
  /**
   * Whether to scroll smoothly or instantly
   * @default false
   */
  smooth?: boolean;
  
  /**
   * Dependency array to trigger scroll
   */
  dependencies?: any[];
}

export interface UseAutoScrollReturn {
  /**
   * Whether auto-scroll is currently active
   */
  isAutoScrollActive: boolean;
  
  /**
   * Whether the user is currently interacting with the scroll area
   */
  isUserInteracting: boolean;
  
  /**
   * Event handlers to attach to the scrollable element
   */
  scrollHandlers: {
    onScroll: () => void;
    onWheel: () => void;
    onMouseDown: () => void;
    onTouchStart: () => void;
  };
  
  /**
   * Manually scroll to bottom
   */
  scrollToBottom: () => void;
  
  /**
   * Toggle auto-scroll on/off
   */
  toggleAutoScroll: () => void;
  
  /**
   * Enable auto-scroll
   */
  enableAutoScroll: () => void;
  
  /**
   * Disable auto-scroll
   */
  disableAutoScroll: () => void;
}

/**
 * Hook for implementing auto-scroll functionality with user interaction detection
 * 
 * @param scrollRef - Reference to the scrollable element
 * @param options - Configuration options
 * @returns Object with auto-scroll state and handlers
 */
export function useAutoScroll(
  scrollRef: RefObject<HTMLElement>,
  options: UseAutoScrollOptions = {}
): UseAutoScrollReturn {
  const {
    enabled = true,
    interactionDelay = 2000,
    smooth = false,
    dependencies = []
  } = options;

  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(enabled);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if auto-scroll is currently active
  const isAutoScrollActive = isAutoScrollEnabled && !isUserInteracting;

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollOptions: ScrollToOptions = {
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      };
      scrollRef.current.scrollTo(scrollOptions);
    }
  }, [scrollRef, smooth]);

  // Handle user interaction
  const handleUserInteraction = useCallback(() => {
    setIsUserInteracting(true);

    // Clear existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }

    // Set a timeout to mark interaction as finished
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, interactionDelay);
  }, [interactionDelay]);

  // Create scroll handlers
  const scrollHandlers = {
    onScroll: handleUserInteraction,
    onWheel: handleUserInteraction,
    onMouseDown: handleUserInteraction,
    onTouchStart: handleUserInteraction
  };

  // Toggle auto-scroll
  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrollEnabled(prev => !prev);
  }, []);

  // Enable auto-scroll
  const enableAutoScroll = useCallback(() => {
    setIsAutoScrollEnabled(true);
    setIsUserInteracting(false);
  }, []);

  // Disable auto-scroll
  const disableAutoScroll = useCallback(() => {
    setIsAutoScrollEnabled(false);
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (isAutoScrollActive) {
      scrollToBottom();
    }
  }, [...dependencies, isAutoScrollActive, scrollToBottom]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  return {
    isAutoScrollActive,
    isUserInteracting,
    scrollHandlers,
    scrollToBottom,
    toggleAutoScroll,
    enableAutoScroll,
    disableAutoScroll
  };
}