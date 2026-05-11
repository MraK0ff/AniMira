import { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAnimeList } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';

export default function Browse() {
  const { currentSource } = useStore();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['animeList', currentSource, category],
    queryFn: ({ pageParam = 1 }) => getAnimeList(currentSource, pageParam, category),
    getNextPageParam: (lastPage) => lastPage.has_next ? lastPage.page + 1 : undefined,
    enabled: !!currentSource,
    initialPageParam: 1,
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle source change: reset category
  useEffect(() => {
    setCategory(undefined);
  }, [currentSource]);

  // Flatten all pages into a single array
  const allItems = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <div className="min-h-screen pt-12 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
        <div className="glass p-6 rounded-2xl sticky top-24">
          <h2 className="text-xl font-bold text-white mb-6">Категории</h2>
          
          <div className="space-y-2">
            <button
              onClick={() => setCategory(undefined)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                !category ? 'bg-primary text-white font-bold' : 'text-text-muted hover:bg-white/5'
              }`}
            >
              Все
            </button>

            {data?.pages?.[0]?.categories?.map((cat: {tag?: string; name: string}) => (
              <button
                key={cat.tag || cat.name}
                onClick={() => setCategory(cat.tag || cat.name)}
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
          {isFetchingNextPage && <div className="text-primary text-sm font-semibold animate-pulse">Загрузка...</div>}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {isLoading && Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}

          {allItems.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </div>

        {!isLoading && allItems.length === 0 && (
          <div className="text-center py-20 text-text-muted">
            По данному критерию ничего не найдено.
          </div>
        )}

        {/* Infinite scroll sentinel and loading indicator */}
        <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Загрузка...</span>
            </div>
          )}
          {!hasNextPage && allItems.length > 0 && (
            <span className="text-text-muted text-sm">Больше нет аниме</span>
          )}
        </div>
      </div>
    </div>
  );
}
