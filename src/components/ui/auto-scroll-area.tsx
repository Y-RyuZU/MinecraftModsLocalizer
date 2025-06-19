"use client";

import * as React from "react";
import { ScrollArea } from "./scroll-area";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { cn } from "@/lib/utils";
import { Checkbox } from "./checkbox";

interface AutoScrollAreaProps extends React.ComponentProps<typeof ScrollArea> {
  /**
   * Whether to enable auto-scroll by default
   * @default true
   */
  autoScroll?: boolean;
  
  /**
   * Whether to show auto-scroll controls
   * @default true
   */
  showControls?: boolean;
  
  /**
   * Label for the auto-scroll checkbox
   * @default "Auto-scroll"
   */
  controlLabel?: string;
  
  /**
   * Position of the controls
   * @default "bottom-right"
   */
  controlPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  
  /**
   * Delay before re-enabling auto-scroll after user interaction
   * @default 2000
   */
  interactionDelay?: number;
  
  /**
   * Dependencies that trigger auto-scroll
   */
  scrollDependencies?: any[];
  
  /**
   * Callback when auto-scroll state changes
   */
  onAutoScrollChange?: (enabled: boolean) => void;
}

const AutoScrollArea = React.forwardRef<
  HTMLDivElement,
  AutoScrollAreaProps
>(({
  autoScroll = true,
  showControls = true,
  controlLabel = "Auto-scroll",
  controlPosition = "bottom-right",
  interactionDelay = 2000,
  scrollDependencies = [],
  onAutoScrollChange,
  className,
  children,
  ...props
}, ref) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  const {
    isAutoScrollActive,
    scrollHandlers,
    toggleAutoScroll,
    enableAutoScroll,
    disableAutoScroll
  } = useAutoScroll(scrollRef as React.RefObject<HTMLElement>, {
    enabled: autoScroll,
    interactionDelay,
    smooth: false,
    dependencies: scrollDependencies
  });

  // Combine refs
  React.useImperativeHandle(ref, () => scrollRef.current!, []);

  // Handle auto-scroll change
  const handleAutoScrollToggle = () => {
    toggleAutoScroll();
    if (onAutoScrollChange) {
      onAutoScrollChange(!isAutoScrollActive);
    }
  };

  // Determine control position classes
  const getControlPositionClasses = () => {
    switch (controlPosition) {
      case "top-left":
        return "top-2 left-2";
      case "top-right":
        return "top-2 right-2";
      case "bottom-left":
        return "bottom-2 left-2";
      case "bottom-right":
      default:
        return "bottom-2 right-2";
    }
  };

  return (
    <div className="relative">
      <ScrollArea
        ref={scrollRef}
        className={className}
        {...scrollHandlers}
        {...props}
      >
        {children}
      </ScrollArea>
      
      {showControls && (
        <div 
          className={cn(
            "absolute z-10 flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border",
            getControlPositionClasses()
          )}
        >
          <Checkbox
            id="auto-scroll-control"
            checked={isAutoScrollActive}
            onCheckedChange={handleAutoScrollToggle}
            className="h-4 w-4"
          />
          <label 
            htmlFor="auto-scroll-control" 
            className="text-xs select-none cursor-pointer"
          >
            {controlLabel}
          </label>
        </div>
      )}
    </div>
  );
});

AutoScrollArea.displayName = "AutoScrollArea";

export { AutoScrollArea };