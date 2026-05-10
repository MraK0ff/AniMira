import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { AnimeItem } from '../types/api';

interface Props {
  anime: AnimeItem;
  source: string;
}

// Parse episodes string like "12/24" or "12 из 24" to get current/total
function parseEpisodes(episodesStr?: string): { current?: number; total?: number } {
  if (!episodesStr) return {};
  
  // Try "12/24" or "12 из 24" format
  const match = episodesStr.match(/(\d+)[\/\sиз]+(\d+)/);
  if (match) {
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
  }
  
  // Try single number
  const single = episodesStr.match(/(\d+)/);
  if (single) {
    return { total: parseInt(single[1]) };
  }
  
  return {};
}

export default function AnimeCard({ anime, source }: Props) {
  const episodes = parseEpisodes(anime.episodes_aired);
  const rating = (anime as any).rating; // Rating might be added to API later

  return (
    <div className="group">
      {/* Image Container */}
      <Link 
        to={`/anime?source=${source}&url=${encodeURIComponent(anime.url)}`} 
        tabIndex={0} 
        className="tv-focusable relative block aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden bg-bg-elevated cursor-pointer transition-transform duration-200 focus:scale-105 focus:z-50 focus:ring-2 md:focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base focus:outline-none"
      >
        <img 
          src={anime.cover || 'https://via.placeholder.com/300x450?text=No+Cover'} 
          alt={anime.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Rating Badge */}
        {rating && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-1.5 py-0.5 rounded">
            <Star size={10} fill="currentColor" className="text-yellow-400" />
            {rating}
          </div>
        )}
        
        
        {/* Episode progress overlay for watching anime */}
        {episodes.current && episodes.total && episodes.current > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-primary"
              style={{ width: `${(episodes.current / episodes.total) * 100}%` }}
            />
          </div>
        )}
      </Link>

      {/* Info Below Image */}
      <div className="mt-2 space-y-0.5">
        <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight">
          {anime.additional_title || anime.title}
        </h3>
        
        {/* Episode Info */}
        <p className="text-text-muted text-xs">
          {episodes.current !== undefined && episodes.total !== undefined ? (
            <>
              {episodes.current} из {episodes.total} эп
              {episodes.current < episodes.total && (
                <span className="text-primary ml-1">• продолжить</span>
              )}
            </>
          ) : episodes.total ? (
            <>{episodes.total} эп</>
          ) : anime.episodes_aired ? (
            <>{anime.episodes_aired}</>
          ) : null}
        </p>
        
        {/* Additional Title (original) */}
        {anime.additional_title && (
          <p className="text-text-muted text-xs line-clamp-1 opacity-70">
            {anime.title}
          </p>
        )}
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-2">
      <div className="aspect-[2/3] rounded-lg md:rounded-xl bg-white/5 animate-pulse" />
      <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
      <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
    </div>
  );
}
