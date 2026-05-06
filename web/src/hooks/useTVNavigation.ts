import { useEffect, useRef, useCallback, useState } from 'react';

interface TVNavigationOptions {
  selector?: string;
  onBack?: () => void;
  onEnter?: (element: HTMLElement) => void;
}

export function useTVNavigation(options: TVNavigationOptions = {}) {
  const { selector = '[data-tv-focusable], button, a, [tabindex]:not([tabindex="-1"])', onBack, onEnter } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isTVMode, setIsTVMode] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const elementsRef = useRef<HTMLElement[]>([]);

  const updateElements = useCallback(() => {
    const container = containerRef.current || document.body;
    elementsRef.current = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }, [selector]);

  const focusElement = useCallback((index: number) => {
    const elements = elementsRef.current;
    if (elements.length === 0) return;
    
    const newIndex = ((index % elements.length) + elements.length) % elements.length;
    setFocusedIndex(newIndex);
    
    const element = elements[newIndex];
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    element.classList.add('tv-focused');
    
    // Remove focus class from others
    elements.forEach((el, i) => {
      if (i !== newIndex) el.classList.remove('tv-focused');
    });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const elements = elementsRef.current;
    if (elements.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        focusElement(focusedIndex + 1);
        setIsTVMode(true);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        focusElement(focusedIndex - 1);
        setIsTVMode(true);
        break;
      case 'Enter':
        e.preventDefault();
        const current = elements[focusedIndex];
        if (current) {
          onEnter?.(current);
          current.click();
        }
        break;
      case 'Backspace':
      case 'Escape':
        e.preventDefault();
        onBack?.();
        break;
      case 'Home':
        e.preventDefault();
        focusElement(0);
        break;
      case 'End':
        e.preventDefault();
        focusElement(elements.length - 1);
        break;
    }
  }, [focusedIndex, focusElement, onBack, onEnter]);

  useEffect(() => {
    // Update elements list periodically and on mutations
    updateElements();
    
    const observer = new MutationObserver(() => {
      updateElements();
    });
    
    observer.observe(containerRef.current || document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener('keydown', handleKeyDown);
    
    // Detect TV mode on first arrow key
    const detectTV = () => setIsTVMode(true);
    document.addEventListener('keydown', detectTV, { once: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, updateElements]);

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
