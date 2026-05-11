import { useQuery } from '@tanstack/react-query';
import { getAnimeSchedule, ScheduleItem } from '../api/client';
import { useStore } from '../store/useStore';
import { Clock, Play } from 'lucide-react';

interface ScheduleWidgetProps {
  source?: string;
}

export default function ScheduleWidget({ source }: ScheduleWidgetProps) {
  const { currentSource } = useStore();
  const targetSource = source || currentSource;

  const { data, isLoading } = useQuery({
    queryKey: ['schedule', targetSource],
    queryFn: () => getAnimeSchedule(targetSource),
    enabled: !!targetSource,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const schedule = data?.schedule || [];

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Следующая серия
        </h2>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-48 h-28 rounded-lg bg-surface/50 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (schedule.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        Следующая серия
      </h2>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {schedule.map((item: ScheduleItem, index: number) => (
          <a
            key={index}
            href={`/anime?source=${encodeURIComponent(targetSource)}&url=${encodeURIComponent(item.url)}`}
            tabIndex={0}
            className="tv-focusable flex-shrink-0 group relative w-48 h-28 rounded-lg overflow-hidden bg-surface"
          >
            {/* Background Image */}
            {item.cover && (
              <img
                src={item.cover}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Play Icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                <Play className="w-6 h-6 text-white fill-white ml-1" />
              </div>
            </div>

            {/* Time Badge */}
            {item.time_left && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary/90 text-white text-xs font-bold">
                {item.time_left}
              </div>
            )}

            {/* Title */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight">
                {item.title}
              </h3>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
