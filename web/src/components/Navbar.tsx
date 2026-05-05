import { Link } from 'react-router-dom';
import { Search, History, Heart, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSources } from '../api/client';
import { useStore } from '../store/useStore';
import clsx from 'clsx';

export default function Navbar() {
  const { currentSource, setSource } = useStore();
  const { data: sources = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: getSources
  });

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-2xl font-black tracking-tighter text-gradient">
          ANILABX
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <Link to="/browse" className="hover:text-white transition-colors">Browse</Link>
          <div className="h-4 w-px bg-white/10" />
          
          <select 
            className="bg-transparent text-white outline-none cursor-pointer"
            value={currentSource}
            onChange={(e) => setSource(e.target.value)}
          >
            {sources.map(s => (
              <option key={s.name} value={s.name} className="bg-bg-elevated text-white">
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-5 text-text-muted">
        <Link to="/search" className="hover:text-white transition-colors">
          <Search size={20} />
        </Link>
        <Link to="/history" className="hover:text-white transition-colors">
          <History size={20} />
        </Link>
        <Link to="/favorites" className="hover:text-white transition-colors">
          <Heart size={20} />
        </Link>
        <button className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
          <User size={16} />
        </button>
      </div>
    </nav>
  );
}
