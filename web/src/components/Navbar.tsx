import { Link } from 'react-router-dom';
import { Search, History, Heart, User } from 'lucide-react';
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
  const animeSources = sources
    .filter(s => {
      const name = s.name.toLowerCase();
      const title = s.title.toLowerCase();
      const mangaKeywords = ['manga', 'manganelo', 'mangaplus', 'remanga', 'readmanga', 'selfmanga', 'zazaza', 'honey-manga'];
      const novelKeywords = ['lightnovel', 'ranobe', 'rulate', 'senu', 'ruranobe', 'readlightnovel'];
      const dramaKeywords = ['doram', 'vdorame'];

      const isManga = mangaKeywords.some(k => name.includes(k) || title.includes(k));
      const isNovel = novelKeywords.some(k => name.includes(k) || title.includes(k));
      const isDrama = dramaKeywords.some(k => name.includes(k) || title.includes(k));

      return !isManga && !isNovel && !isDrama;
    })
    .sort((a, b) => {
      // Priority: anistar first, anilibria second, then alphabetical
      if (a.name === 'anistar') return -1;
      if (b.name === 'anistar') return 1;
      if (a.name === 'anilibria') return -1;
      if (b.name === 'anilibria') return 1;
      return a.title.localeCompare(b.title);
    });

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="tv-focusable text-2xl font-black tracking-tighter text-gradient">
          ANILABX
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
          <Link to="/" className="tv-focusable hover:text-white transition-colors">Home</Link>
          <Link to="/browse" className="tv-focusable hover:text-white transition-colors">Browse</Link>
          <div className="h-4 w-px bg-white/10" />
        </div>

        {/* Source selector - visible on all devices */}
        <select
          className="tv-focusable bg-transparent text-white outline-none cursor-pointer text-sm"
          value={currentSource}
          onChange={(e) => setSource(e.target.value)}
        >
          {animeSources.map(s => (
            <option key={s.name} value={s.name} className="bg-bg-elevated text-white">
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-5 text-text-muted">
        <Link to="/search" className="tv-focusable hover:text-white transition-colors p-2">
          <Search size={20} />
        </Link>
        <Link to="/history" className="tv-focusable hover:text-white transition-colors p-2">
          <History size={20} />
        </Link>
        <Link to="/favorites" className="tv-focusable hover:text-white transition-colors p-2">
          <Heart size={20} />
        </Link>
        <button className="tv-focusable h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
          <User size={16} />
        </button>
      </div>
    </nav>
  );
}
