import { memo, useCallback } from 'react';
import { Play, Radio } from 'lucide-react';
import clsx from 'clsx';
import type { Episode } from '../types/api';

interface EpisodeCardProps {
  episode: Episode;
  index: number;
  isActive: boolean;
  isPlaying?: boolean;
  showSource?: boolean;
  onClick: (episode: Episode) => void;
  onFocus?: (element: HTMLElement) => void;
}

function EpisodeCardInternal({
  episode,
  index,
  isActive,
  isPlaying = false,
  showSource = true,
  onClick,
  onFocus,
}: EpisodeCardProps) {
  const handleClick = useCallback(() => {
    onClick(episode);
  }, [episode, onClick]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLButtonElement>) => {
    onFocus?.(e.currentTarget);
  }, [onFocus]);

  // Extract episode number from title for display
  const episodeNumber = index + 1;
  const displayTitle = episode.uniq || episode.title;

  return (
    <button
      onClick={handleClick}
      onFocus={handleFocus}
      tabIndex={0}
      data-episode-url={episode.url}
      className={clsx(
        'tv-focusable group relative w-full text-left p-4 rounded-xl transition-all duration-200',
        'border-2 backdrop-blur-md',
        isActive
          ? 'bg-primary/20 border-primary shadow-lg shadow-primary/20 scale-[1.02]'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
      )}
    >
      {/* Active/Playing indicator line */}
      <div
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full transition-all duration-200',
          isActive ? 'bg-primary scale-y-100' : 'bg-transparent scale-y-0',
        )}
      />

      <div className="flex items-center gap-4">
        {/* Episode number / Play icon circle */}
        <div
          className={clsx(
            'w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-200',
            isActive
              ? 'bg-primary text-white shadow-lg shadow-primary/40'
              : 'bg-white/10 text-white/70 group-hover:bg-white/20 group-hover:text-white',
          )}
        >
          {isActive && isPlaying ? (
            <Radio size={20} className="animate-pulse" />
          ) : (
            <Play size={18} className="ml-0.5" />
          )}
        </div>

        {/* Episode info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'text-sm font-bold px-2 py-0.5 rounded-full',
                isActive
                  ? 'bg-primary/30 text-primary'
                  : 'bg-white/10 text-white/60',
              )}
            >
              #{episodeNumber}
            </span>
            {isActive && (
              <span className="text-xs font-medium text-primary animate-pulse">
                Сейчас играет
              </span>
            )}
          </div>
          <h4
            className={clsx(
              'font-semibold truncate mt-1 transition-colors',
              isActive ? 'text-white' : 'text-white/80 group-hover:text-white',
            )}
            title={displayTitle}
          >
            {displayTitle}
          </h4>
          {showSource && episode.service && (
            <p
              className={clsx(
                'text-xs mt-0.5 truncate',
                isActive ? 'text-primary/70' : 'text-white/50',
              )}
            >
              {episode.service}
            </p>
          )}
        </div>

        {/* Quality badges */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          {episode.url720 && (
            <span
              className={clsx(
                'text-xs font-bold px-2 py-0.5 rounded',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/60',
              )}
            >
              720p
            </span>
          )}
          {episode.url360 && (
            <span
              className={clsx(
                'text-xs font-bold px-2 py-0.5 rounded',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/60',
              )}
            >
              360p
            </span>
          )}
        </div>
      </div>

      {/* Progress bar for active episode */}
      {isActive && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: isPlaying ? '60%' : '0%' }}
          />
        </div>
      )}
    </button>
  );
}

// Memoize to prevent re-renders during playback
export const EpisodeCard = memo(EpisodeCardInternal, (prev, next) => {
  return (
    prev.episode.url === next.episode.url &&
    prev.isActive === next.isActive &&
    prev.isPlaying === next.isPlaying &&
    prev.index === next.index
  );
});

export default EpisodeCard;
