import { Link } from 'react-router-dom';
import { Search, History, Heart, User, Smartphone, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSources } from '../api/client';
import { useStore } from '../store/useStore';

export default function Navbar() {
  const { currentSource, setSource } = useStore();
  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: getSources
  });

  // Filter out manga, drama and novel sources - only anime
  const animeSources = Array.isArray(sources) 
    ? sources.filter(s => {
      const name = s.name.toLowerCase();
      const title = s.title.toLowerCase();
      const mangaKeywords = ['manga', 'manganelo', 'mangaplus', 'remanga', 'readmanga', 'selfmanga', 'zazaza', 'honey-manga'];
      const novelKeywords = ['lightnovel', 'ranobe', 'rulate', 'senu', 'ruranobe', 'readlightnovel'];
      const dramaKeywords = ['doram', 'vdorame'];

      const isManga = mangaKeywords.some(k => name.includes(k) || title.includes(k));
      const isNovel = novelKeywords.some(k => name.includes(k) || title.includes(k));
      const isDrama = dramaKeywords.some(k => name.includes(k) || title.includes(k));

      return !isManga && !isNovel && !isDrama;
    }).sort((a, b) => {
      // Priority: anistar first, anilibria second, then alphabetical
      if (a.name === 'anistar') return -1;
      if (b.name === 'anistar') return 1;
      if (a.name === 'anilibria') return -1;
      if (b.name === 'anilibria') return 1;
      return a.title.localeCompare(b.title);
    })
    : [];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 md:gap-8 min-w-0 flex-1">
        <Link to="/" tabIndex={0} className="tv-focusable text-xl md:text-2xl font-black tracking-tighter text-white flex-shrink-0">
          ANIMIRA
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted flex-shrink-0">
          <Link to="/" tabIndex={0} className="tv-focusable hover:text-white transition-colors">Home</Link>
          <div className="h-4 w-px bg-white/10" />
        </div>

        {/* Source selector - visible on all devices */}
        <select
          className="tv-focusable bg-transparent text-white outline-none cursor-pointer text-xs md:text-sm p-1.5 md:p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary max-w-[120px] md:max-w-[200px] truncate"
          value={currentSource}
          onChange={(e) => setSource(e.target.value)}
          tabIndex={0}
        >
          {animeSources.map(s => (
            <option key={s.name} value={s.name} className="bg-bg-elevated text-white">
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 md:gap-5 text-text-muted flex-shrink-0">
        <Link to="/shikimori" tabIndex={0} className="tv-focusable hover:text-blue-400 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hidden sm:flex" title="Shikimori поиск">
          <Globe size={20} className="text-blue-400" />
        </Link>
        <Link to="/download" tabIndex={0} className="tv-focusable hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hidden sm:flex" title="Скачать для TV">
          <Smartphone size={20} />
        </Link>
        <Link to="/search" tabIndex={0} className="tv-focusable hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Search size={20} />
        </Link>
        <Link to="/history" tabIndex={0} className="tv-focusable hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hidden sm:flex">
          <History size={20} />
        </Link>
        <Link to="/favorites" tabIndex={0} className="tv-focusable hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hidden sm:flex">
          <Heart size={20} />
        </Link>
        <button tabIndex={0} className="tv-focusable h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white min-w-[44px] min-h-[44px]">
          <User size={16} />
        </button>
      </div>
    </nav>
  );
}
