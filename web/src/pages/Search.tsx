import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchAnime } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';
import { Search as SearchIcon, X } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce'; // We need to create this hook

export default function Search() {
  const { currentSource } = useStore();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['animeSearch', currentSource, debouncedQuery],
    queryFn: () => searchAnime(currentSource, debouncedQuery, 1),
    enabled: !!currentSource && debouncedQuery.length > 2,
  });

  // Clear query on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuery('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen pt-12 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
      {/* Search Input Area */}
      <div className="relative mb-12 max-w-3xl mx-auto">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-6 text-text-muted" size={24} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Поиск в ${currentSource}...`}
            className="w-full bg-white/5 border border-white/10 rounded-full py-5 pl-16 pr-14 text-xl text-white placeholder-text-muted focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all shadow-xl"
            autoFocus
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute right-6 text-text-muted hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Results Area */}
      <div className="space-y-6">
        {debouncedQuery.length > 2 && (
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold text-white">
              Результаты по запросу «{debouncedQuery}»
            </h2>
            {isFetching && <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          </div>
        )}

        {/* Loading */}
        {isLoading && debouncedQuery.length > 2 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Loaded Results */}
        {!isLoading && data && (
          <>
            {data.items.length === 0 ? (
              <div className="text-center py-20 text-text-muted">
                <SearchIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-xl">Ничего не найдено</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
                {data.items.map((anime) => (
                  <AnimeCard key={anime.url} anime={anime} source={currentSource} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Initial Empty State */}
        {debouncedQuery.length <= 2 && (
          <div className="text-center py-20 text-text-muted">
            <p className="text-lg">Введите название аниме для поиска (минимум 3 символа)</p>
          </div>
        )}
      </div>
    </div>
  );
}
