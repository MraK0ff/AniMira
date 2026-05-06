import { useEffect, useRef, useCallback, useState } from 'react';

interface TVNavigationOptions {
  selector?: string;
  onBack?: () => void;
  onEnter?: (element: HTMLElement) => void;
}

interface ElementRect {
  element: HTMLElement;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function useTVNavigation(options: TVNavigationOptions = {}) {
  const { selector = '[data-tv-focusable], .tv-focusable, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), select, input, .cursor-pointer', onBack, onEnter } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isTVMode, setIsTVMode] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const elementsRef = useRef<ElementRect[]>([]);

  const updateElements = useCallback(() => {
    const container = containerRef.current || document.body;
    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    
    elementsRef.current = elements.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        element: el,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
  }, [selector]);

  const getCurrentElement = useCallback(() => {
    const active = document.activeElement as HTMLElement;
    const index = elementsRef.current.findIndex(r => r.element === active);
    return index >= 0 ? elementsRef.current[index] : elementsRef.current[focusedIndex];
  }, [focusedIndex]);

  const findNextInDirection = useCallback((direction: 'up' | 'down' | 'left' | 'right'): ElementRect | null => {
    const current = getCurrentElement();
    if (!current) return null;

    const candidates = elementsRef.current.filter(r => r.element !== current.element);
    if (candidates.length === 0) return null;

    let bestCandidate: ElementRect | null = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      let isInDirection = false;
      let distance: number;
      let alignment: number;

      switch (direction) {
        case 'down':
          isInDirection = candidate.top > current.bottom - 10;
          distance = candidate.top - current.bottom;
          alignment = -Math.abs(candidate.centerX - current.centerX);
          break;
        case 'up':
          isInDirection = candidate.bottom < current.top + 10;
          distance = current.top - candidate.bottom;
          alignment = -Math.abs(candidate.centerX - current.centerX);
          break;
        case 'right':
          isInDirection = candidate.left > current.right - 10;
          distance = candidate.left - current.right;
          alignment = -Math.abs(candidate.centerY - current.centerY);
          break;
        case 'left':
          isInDirection = candidate.right < current.left + 10;
          distance = current.left - candidate.right;
          alignment = -Math.abs(candidate.centerY - current.centerY);
          break;
      }

      if (isInDirection) {
        // Score: prefer closer elements with better alignment
        const score = -distance * 2 + alignment;
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
    }

    return bestCandidate;
  }, [getCurrentElement]);

  const focusElement = useCallback((rect: ElementRect | null) => {
    if (!rect) return;
    
    const index = elementsRef.current.findIndex(r => r.element === rect.element);
    if (index >= 0) {
      setFocusedIndex(index);
    }
    
    rect.element.focus();
    rect.element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    rect.element.classList.add('tv-focused');
    
    // Remove focus class from others
    elementsRef.current.forEach(r => {
      if (r.element !== rect.element) r.element.classList.remove('tv-focused');
    });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (elementsRef.current.length === 0) {
      console.log('[TV Navigation] No elements found, skipping key:', e.key);
      return;
    }

    console.log('[TV Navigation] Key pressed:', e.key, 'Elements count:', elementsRef.current.length);

    let nextElement: ElementRect | null = null;
    let direction: 'up' | 'down' | 'left' | 'right' | null = null;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        direction = 'down';
        setIsTVMode(true);
        break;
      case 'ArrowUp':
        e.preventDefault();
        direction = 'up';
        setIsTVMode(true);
        break;
      case 'ArrowRight':
        e.preventDefault();
        direction = 'right';
        setIsTVMode(true);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        direction = 'left';
        setIsTVMode(true);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        const current = getCurrentElement();
        if (current) {
          console.log('[TV Navigation] Clicking element:', current.element);
          onEnter?.(current.element);
          
          // Special handling for select elements
          if (current.element.tagName === 'SELECT') {
            // For select, try to open the dropdown
            const event = new MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            current.element.dispatchEvent(event);
            // Also try focus and click
            current.element.focus();
            (current.element as HTMLSelectElement).click();
          } else {
            current.element.click();
          }
        }
        return;
      case 'Backspace':
      case 'Escape':
        e.preventDefault();
        onBack?.();
        return;
      case 'Home':
        e.preventDefault();
        if (elementsRef.current.length > 0) {
          focusElement(elementsRef.current[0]);
        }
        setIsTVMode(true);
        return;
      case 'End':
        e.preventDefault();
        if (elementsRef.current.length > 0) {
          focusElement(elementsRef.current[elementsRef.current.length - 1]);
        }
        setIsTVMode(true);
        return;
    }

    if (direction) {
      nextElement = findNextInDirection(direction);
      
      // Fallback to linear navigation if geometric fails
      if (!nextElement) {
        const current = getCurrentElement();
        const currentIdx = current ? elementsRef.current.findIndex(r => r.element === current.element) : 0;
        let nextIdx = currentIdx;
        
        if (direction === 'down' || direction === 'right') {
          nextIdx = Math.min(currentIdx + 1, elementsRef.current.length - 1);
        } else {
          nextIdx = Math.max(currentIdx - 1, 0);
        }
        
        if (nextIdx !== currentIdx) {
          nextElement = elementsRef.current[nextIdx];
          console.log('[TV Navigation] Using linear fallback to index:', nextIdx);
        }
      }
      
      if (nextElement) {
        console.log('[TV Navigation] Moving to element:', nextElement.element);
        focusElement(nextElement);
      } else {
        console.log('[TV Navigation] No next element found for direction:', direction);
      }
    }
  }, [findNextInDirection, focusElement, getCurrentElement, onBack, onEnter]);

  useEffect(() => {
    let hasUserInteracted = false;
    
    // Delay initial update to ensure DOM is ready
    const initTimeout = setTimeout(() => {
      updateElements();
      console.log('[TV Navigation] Found elements:', elementsRef.current.length);
      
      // Focus first element on mount only if user hasn't interacted yet
      if (elementsRef.current.length > 0 && !hasUserInteracted && 
          (document.activeElement === document.body || document.activeElement === null)) {
        focusElement(elementsRef.current[0]);
        console.log('[TV Navigation] Focused first element on mount');
      }
    }, 500);
    
    // Track user interaction to prevent resetting focus
    const markInteracted = () => { hasUserInteracted = true; };
    document.addEventListener('keydown', markInteracted, { once: true });
    document.addEventListener('click', markInteracted, { once: true });
    
    // Periodic refresh for dynamic content - but don't steal focus
    const refreshInterval = setInterval(() => {
      updateElements();
    }, 5000);
    
    const observer = new MutationObserver(() => {
      updateElements();
    });
    
    observer.observe(containerRef.current || document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener('keydown', handleKeyDown);
    console.log('[TV Navigation] Hook mounted, listening for keys');
    
    // Ensure body is clickable to establish focus
    const handleBodyClick = () => {
      if (elementsRef.current.length > 0 && document.activeElement === document.body) {
        focusElement(elementsRef.current[0]);
      }
    };
    document.body.addEventListener('click', handleBodyClick);
    
    return () => {
      clearTimeout(initTimeout);
      clearInterval(refreshInterval);
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', markInteracted);
      document.removeEventListener('click', markInteracted);
      document.body.removeEventListener('click', handleBodyClick);
    };
  }, [handleKeyDown, updateElements, focusElement]);

  return {
    containerRef,
    focusedIndex,
    isTVMode,
    setContainerRef: (el: HTMLElement | null) => {
      containerRef.current = el;
      updateElements();
    },
  };
}

// Hook for TV-specific scroll handling
export function useTVScroll() {
  const scrollToElement = useCallback((element: HTMLElement) => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }, []);

  return { scrollToElement };
}
