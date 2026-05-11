import { useInfiniteQuery } from '@tanstack/react-query';
import { getAnimeList } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';
import ScheduleWidget from '../components/ScheduleWidget';
import { useState, useEffect, useRef } from 'react';

// Categories from anistar.json
const DEFAULT_FILTERS = [
  { tag: 'main', name: 'Последние' },
  { tag: 'dorama', name: 'Дорамы' },
  { tag: 'new', name: 'Новинки' },
  { tag: 'rpg', name: 'RPG' },
  { tag: 'china', name: 'Китай' },
];

export default function Home() {
  const { currentSource } = useStore();
  const [activeFilter, setActiveFilter] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch list with infinite scroll
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['animeList', currentSource, activeFilter],
    queryFn: ({ pageParam = 1 }) => getAnimeList(currentSource, pageParam, activeFilter || undefined),
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

  // Flatten all pages into a single array
  const allItems = data?.pages.flatMap(page => page.items) ?? [];

  // Always use default filters
  const filters = DEFAULT_FILTERS;

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 lg:px-8">
      {/* Filter Tabs */}
      <div className="sticky top-16 z-40 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 bg-bg-base/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter.tag}
              onClick={() => setActiveFilter(filter.tag)}
              tabIndex={0}
              className={`tv-focusable whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filter.tag
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Widget */}
      <div className="mt-6">
        <ScheduleWidget />
      </div>

      {/* Section Title */}
      <h2 className="text-lg md:text-xl font-bold text-white mt-6 mb-4">
        {data?.pages?.[0]?.categories?.[0]?.name || 'Аниме'}
      </h2>

      {/* Loading State - Grid */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Anime Grid */}
      {!isLoading && allItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
          {allItems.map((anime) => (
            <AnimeCard key={anime.url + anime.title} anime={anime} source={currentSource} />
          ))}
        </div>
      )}

      {/* Loading more indicator */}
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

      {/* Empty state */}
      {!isLoading && allItems.length === 0 && (
        <div className="py-12 md:py-16 text-center">
          <p className="text-text-muted text-sm md:text-base">Нет аниме для источника: {currentSource}</p>
          <p className="text-text-muted text-xs md:text-sm mt-2">Попробуйте выбрать другой источник</p>
        </div>
      )}
    </div>
  );
}
