import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnimeList } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';

export default function Browse() {
  const { currentSource } = useStore();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['animeList', currentSource, page, category],
    queryFn: () => getAnimeList(currentSource, page, category),
    enabled: !!currentSource,
  });

  // Handle source change: reset page and category
  useEffect(() => {
    setPage(1);
    setCategory(undefined);
  }, [currentSource]);

  return (
    <div className="min-h-screen pt-12 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
        <div className="glass p-6 rounded-2xl sticky top-24">
          <h2 className="text-xl font-bold text-white mb-6">Категории</h2>
          
          <div className="space-y-2">
            <button
              onClick={() => { setCategory(undefined); setPage(1); }}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                !category ? 'bg-primary text-white font-bold' : 'text-text-muted hover:bg-white/5'
              }`}
            >
              Все
            </button>
            
            {data?.categories?.map((cat) => (
              <button
                key={cat.tag || cat.name}
                onClick={() => { setCategory(cat.tag || cat.name); setPage(1); }}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  category === (cat.tag || cat.name) 
                    ? 'bg-primary text-white font-bold' 
                    : 'text-text-muted hover:bg-white/5'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Grid */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-white">Каталог</h1>
          {isFetching && <div className="text-primary text-sm font-semibold animate-pulse">Загрузка...</div>}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {isLoading && Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          
          {!isLoading && data?.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </div>

        {!isLoading && data?.items.length === 0 && (
          <div className="text-center py-20 text-text-muted">
            По данному критерию ничего не найдено.
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && data?.items.length !== 0 && (
          <div className="mt-16 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 hover:bg-white/20 transition-colors font-bold"
            >
              Назад
            </button>
            <span className="text-white font-semibold">Страница {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!data?.has_next}
              className="px-6 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 hover:bg-white/20 transition-colors font-bold"
            >
              Вперед
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
