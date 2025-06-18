/**
 * Scroll utilities for consistent scroll behavior across the application
 */

/**
 * Smoothly scrolls an element into view with configurable options
 */
export function scrollIntoView(
  element: HTMLElement,
  options: ScrollIntoViewOptions = {}
): void {
  const defaultOptions: ScrollIntoViewOptions = {
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
    ...options
  };
  
  element.scrollIntoView(defaultOptions);
}

/**
 * Scrolls to the bottom of a scrollable container
 */
export function scrollToBottom(
  container: HTMLElement,
  smooth: boolean = true
): void {
  container.scrollTo({
    top: container.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant'
  });
}

/**
 * Scrolls to the top of a scrollable container
 */
export function scrollToTop(
  container: HTMLElement,
  smooth: boolean = true
): void {
  container.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'instant'
  });
}

/**
 * Checks if an element is scrolled to the bottom
 */
export function isScrolledToBottom(
  container: HTMLElement,
  threshold: number = 5
): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

/**
 * Checks if an element is scrolled to the top
 */
export function isScrolledToTop(
  container: HTMLElement,
  threshold: number = 5
): boolean {
  return container.scrollTop <= threshold;
}

/**
 * Gets the scroll percentage of a container
 */
export function getScrollPercentage(container: HTMLElement): number {
  const { scrollTop, scrollHeight, clientHeight } = container;
  if (scrollHeight === clientHeight) return 100;
  return (scrollTop / (scrollHeight - clientHeight)) * 100;
}

/**
 * Scrolls to a specific percentage of a container
 */
export function scrollToPercentage(
  container: HTMLElement,
  percentage: number,
  smooth: boolean = true
): void {
  const { scrollHeight, clientHeight } = container;
  const maxScroll = scrollHeight - clientHeight;
  const targetScroll = (percentage / 100) * maxScroll;
  
  container.scrollTo({
    top: targetScroll,
    behavior: smooth ? 'smooth' : 'instant'
  });
}

/**
 * Preserves scroll position during a state update
 */
export function preserveScrollPosition<T>(
  container: HTMLElement,
  updateFn: () => T
): T {
  const scrollTop = container.scrollTop;
  const result = updateFn();
  container.scrollTop = scrollTop;
  return result;
}

/**
 * Creates a scroll restoration handler for dialog/modal scenarios
 */
export function createScrollRestoration() {
  let savedPosition = 0;
  
  return {
    save(container: HTMLElement) {
      savedPosition = container.scrollTop;
    },
    restore(container: HTMLElement) {
      container.scrollTop = savedPosition;
    },
    reset() {
      savedPosition = 0;
    }
  };
}