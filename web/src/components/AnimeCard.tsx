import { Link } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';
import { AnimeItem } from '../types/api';
import { useStore } from '../store/useStore';

interface Props {
  anime: AnimeItem;
  source: string;
}

export default function AnimeCard({ anime, source }: Props) {
  const { isFavorite, toggleFavorite } = useStore();
  const fav = isFavorite(anime.url);

  return (
    <Link 
      to={`/anime?source=${source}&url=${encodeURIComponent(anime.url)}`} 
      tabIndex={0} 
      className="tv-focusable group relative flex-none w-40 md:w-56 aspect-[2/3] rounded-xl overflow-hidden bg-bg-elevated cursor-pointer block transition-transform duration-200 focus:scale-105 focus:z-50 focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base focus:outline-none"
    >
      <div className="w-full h-full">
        <img 
          src={anime.cover || 'https://via.placeholder.com/300x450?text=No+Cover'} 
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {anime.episodes_aired && (
            <span className="bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md">
              {anime.episodes_aired}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform">
          <h3 className="text-white font-bold text-sm line-clamp-2 leading-snug shadow-black drop-shadow-md">
            {anime.additional_title || anime.title}
          </h3>
          {anime.additional_title && (
            <p className="text-text-muted text-xs line-clamp-1 mt-1">
              {anime.title}
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions (Hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex flex-col gap-2 pointer-events-auto">
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(anime); }}
          className="p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-primary transition-colors"
        >
          <Heart size={14} fill={fav ? 'currentColor' : 'none'} className={fav ? 'text-pink-500' : ''} />
        </button>
      </div>
      
      {/* Play Overlay - visible on hover and focus */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-primary/80 backdrop-blur-md flex items-center justify-center text-white transform scale-50 group-hover:scale-100 group-focus:scale-100 transition-transform duration-300">
          <Play size={24} className="ml-1" />
        </div>
      </div>
    </Link>
  );
}

export function SkeletonCard() {
  return (
    <div className="flex-none w-40 md:w-56 aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
  );
}
