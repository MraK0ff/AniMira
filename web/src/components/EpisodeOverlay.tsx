import { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ListVideo } from 'lucide-react';
import clsx from 'clsx';
import { EpisodeCard } from './EpisodeCard';
import type { Episode } from '../types/api';

interface EpisodeOverlayProps {
  isOpen: boolean;
  episodes: Episode[];
  currentEpisode: Episode | undefined;
  isPlaying: boolean;
  onClose: () => void;
  onSelect: (episode: Episode) => void;
}

/**
 * Deduplicate episodes by uniq or title identifier
 * Groups multiple sources for the same episode
 */
export function deduplicateEpisodes(episodes: Episode[]): Map<string, Episode[]> {
  const groups = new Map<string, Episode[]>();

  episodes.forEach((ep) => {
    const key = ep.uniq || ep.title;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(ep);
  });

  return groups;
}

/**
 * Select the best quality episode from a group
 * Prefers: direct links > 720p > 360p > embed
 */
export function selectBestEpisode(episodes: Episode[]): Episode {
  // First, try to find episodes with direct links
  const directEpisodes = episodes.filter((ep) => ep.direct_links);
  const candidates = directEpisodes.length > 0 ? directEpisodes : episodes;

  // Sort by quality preference (720p > 360p > embed)
  return candidates.sort((a, b) => {
    if (a.url720 && !b.url720) return -1;
    if (!a.url720 && b.url720) return 1;
    if (a.url360 && !b.url360) return -1;
    if (!a.url360 && b.url360) return 1;
    return 0;
  })[0] || episodes[0];
}

export default function EpisodeOverlay({
  isOpen,
  episodes,
  currentEpisode,
  isPlaying,
  onClose,
  onSelect,
}: EpisodeOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);

  // Deduplicate and prepare episodes
  const { uniqueEpisodes, totalCount } = useMemo(() => {
    const groups = deduplicateEpisodes(episodes);
    const unique: Episode[] = [];

    // Convert groups to unique episodes (select best from each group)
    groups.forEach((group) => {
      unique.push(selectBestEpisode(group));
    });

    // Sort by episode number if possible, otherwise keep original order
    const sorted = unique.sort((a, b) => {
      const numA = extractEpisodeNumber(a.uniq || a.title);
      const numB = extractEpisodeNumber(b.uniq || b.title);
      if (numA && numB) return numA - numB;
      return 0;
    });

    return {
      uniqueEpisodes: sorted,
      totalCount: groups.size,
    };
  }, [episodes]);

  // Find current episode index
  const currentIndex = useMemo(() => {
    if (!currentEpisode) return -1;
    return uniqueEpisodes.findIndex(
      (ep) => ep.url === currentEpisode.url ||
              (ep.uniq && ep.uniq === currentEpisode.uniq) ||
              (ep.title === currentEpisode.title)
    );
  }, [currentEpisode, uniqueEpisodes]);

  // Handle card focus for TV navigation - auto scroll into view
  const handleCardFocus = useCallback((element: HTMLElement) => {
    activeCardRef.current = element;
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, []);

  // Handle episode selection
  const handleSelect = useCallback((episode: Episode) => {
    onSelect(episode);
    onClose();
  }, [onSelect, onClose]);

  // Scroll to active episode when overlay opens
  useEffect(() => {
    if (isOpen && listRef.current && currentIndex >= 0) {
      // Small delay to allow render
      const timeout = setTimeout(() => {
        const activeCard = listRef.current?.querySelector('[data-episode-active="true"]');
        if (activeCard) {
          activeCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, currentIndex]);

  // Handle keyboard - close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus within overlay when open
  useEffect(() => {
    if (!isOpen) return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    // Focus the close button initially, then let user navigate to episodes
    const closeButton = overlay.querySelector('[data-close-button]') as HTMLElement;
    if (closeButton) {
      setTimeout(() => closeButton.focus(), 50);
    }
  }, [isOpen]);

  if (uniqueEpisodes.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Overlay Panel */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={clsx(
              'fixed z-50 right-0 top-0 bottom-0 w-full max-w-md',
              'bg-gradient-to-l from-black/95 via-black/90 to-black/80',
              'backdrop-blur-xl border-l border-white/10',
              'shadow-2xl shadow-black/50',
              'flex flex-col'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <ListVideo size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Список серий</h2>
                  <p className="text-sm text-white/50">
                    {currentIndex >= 0
                      ? `Серия ${currentIndex + 1} из ${totalCount}`
                      : `${totalCount} серий`}
                  </p>
                </div>
              </div>

              <button
                data-close-button
                onClick={onClose}
                tabIndex={0}
                className="tv-focusable w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Закрыть"
              >
                <X size={20} className="text-white/70" />
              </button>
            </div>

            {/* Episode List */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
            >
              {uniqueEpisodes.map((episode, index) => {
                const isActive = index === currentIndex;

                return (
                  <EpisodeCard
                    key={episode.url}
                    episode={episode}
                    index={index}
                    isActive={isActive}
                    isPlaying={isActive && isPlaying}
                    showSource={true}
                    onClick={handleSelect}
                    onFocus={handleCardFocus}
                  />
                );
              })}
            </div>

            {/* Footer info */}
            <div className="p-4 border-t border-white/10 bg-black/20 text-center">
              <p className="text-xs text-white/40">
                Навигация: ↑↓ выбор, Enter - открыть, Esc - закрыть
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Extract episode number from title string
 */
function extractEpisodeNumber(title: string): number | null {
  const patterns = [
    /[-\s]\s*(\d+)\s*\[/, // " - 05 [" or "- 5 ["
    /\s(\d{2,3})\s*\[/, // " 05 [" or " 108 ["
    /серия\s*(\d+)/i, // "серия 05" or "серия 5"
    /episode\s*(\d+)/i, // "episode 05"
    /ep\s*(\d+)/i, // "ep 5"
    /\s(\d+)\s*\.\s*(mp4|mkv|avi)/i, // " 05.mp4"
    /\[(\d{2,3})\]/, // "[05]"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 1000) return num;
    }
  }
  return null;
}
