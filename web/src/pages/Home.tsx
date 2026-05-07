import { useQuery } from '@tanstack/react-query';
import { getAnimeList } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';
import Carousel from '../components/Carousel';

export default function Home() {
  const { currentSource } = useStore();

  // Fetch initial list (popular/latest)
  const { data: listData, isLoading } = useQuery({
    queryKey: ['animeList', currentSource, 1],
    queryFn: () => getAnimeList(currentSource, 1),
    enabled: !!currentSource
  });

  // Example of fetching a specific category if categories are available
  const category1 = listData?.categories?.[1]?.tag;
  const { data: catData, isLoading: isCatLoading } = useQuery({
    queryKey: ['animeList', currentSource, 1, category1],
    queryFn: () => getAnimeList(currentSource, 1, category1),
    enabled: !!currentSource && !!category1
  });

  return (
    <div className="min-h-screen pb-20">

      {/* Loading State */}
      {isLoading && (
        <Carousel title="Latest Releases">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </Carousel>
      )}

      {/* Debug info */}
      {!isLoading && (
        <div className="px-4 md:px-6 py-2 md:py-4 text-xs text-text-muted truncate">
          Source: {currentSource || 'none'} | items: {Array.isArray(listData?.items) ? listData?.items?.length || 0 : 0}
        </div>
      )}

      {/* Latest Carousel */}
      {!isLoading && listData && Array.isArray(listData.items) && listData.items.length > 0 && (
        <Carousel title={listData.categories?.[0]?.name || "Latest Releases"}>
          {listData.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </Carousel>
      )}

      {/* Empty state */}
      {!isLoading && (!listData || !Array.isArray(listData.items) || listData.items.length === 0) && (
        <div className="px-4 md:px-6 py-8 md:py-12 text-center">
          <p className="text-text-muted text-sm md:text-base">No anime found for source: {currentSource}</p>
          <p className="text-text-muted text-xs md:text-sm mt-2">Try selecting a different source</p>
        </div>
      )}

      {/* Category Carousel */}
      {!isCatLoading && catData && Array.isArray(catData.items) && catData.items.length > 0 && (
        <Carousel title={listData?.categories?.[1]?.name || "More Anime"}>
          {catData.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </Carousel>
      )}
    </div>
  );
}
