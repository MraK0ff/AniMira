import { useEffect, useCallback } from 'react';

interface PlayerKeyboardOptions {
  onTogglePlay: () => void;
  onSeekForward: (seconds: number) => void;
  onSeekBackward: (seconds: number) => void;
  onToggleFullscreen: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  onShowEpisodes?: () => void;
  enabled?: boolean;
}

export function usePlayerKeyboard({
  onTogglePlay,
  onSeekForward,
  onSeekBackward,
  onToggleFullscreen,
  onVolumeUp,
  onVolumeDown,
  onMute,
  onNextEpisode,
  onPrevEpisode,
  onShowEpisodes,
  enabled = true,
}: PlayerKeyboardOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        onTogglePlay();
        break;

      case 'ArrowRight':
      case 'l':
      case 'L':
        e.preventDefault();
        onSeekForward(10);
        break;

      case 'ArrowLeft':
      case 'j':
      case 'J':
        e.preventDefault();
        onSeekBackward(10);
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        onToggleFullscreen();
        break;

      case 'ArrowUp':
        e.preventDefault();
        onVolumeUp?.();
        break;

      case 'ArrowDown':
        e.preventDefault();
        onVolumeDown?.();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        onMute?.();
        break;

      case 'n':
      case 'N':
        e.preventDefault();
        onNextEpisode?.();
        break;

      case 'p':
      case 'P':
        e.preventDefault();
        onPrevEpisode?.();
        break;

      case 'e':
      case 'E':
        e.preventDefault();
        onShowEpisodes?.();
        break;
    }
  }, [
    enabled,
    onTogglePlay,
    onSeekForward,
    onSeekBackward,
    onToggleFullscreen,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onNextEpisode,
    onPrevEpisode,
    onShowEpisodes,
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default usePlayerKeyboard;
