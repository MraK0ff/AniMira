import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideoInfo } from '../api/client';
import Hls from 'hls.js';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams.get('source');
  const episodeUrl = searchParams.get('episode_url');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: videoInfo, isLoading } = useQuery({
    queryKey: ['video', source, episodeUrl],
    queryFn: () => getVideoInfo(source!, episodeUrl!),
    enabled: !!source && !!episodeUrl
  });

  useEffect(() => {
    if (!videoInfo || !videoRef.current) return;

    const video = videoRef.current;
    let hls: Hls | null = null;

    // Route everything through our proxy to avoid CORS and Referer 403 blocks
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(videoInfo.url)}&referer=${encodeURIComponent(videoInfo.referer || '')}`;

    // Check if it's an m3u8 stream
    if (videoInfo.url.includes('.m3u8') || videoInfo.url.includes('m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls({
          xhrSetup: (xhr, url) => {
            // Apply custom headers if possible in browser environment
            // Note: Browsers block custom headers in simple GETs usually,
            // but we might need a proxy for full support.
            // For now, we trust the backend provided a direct usable URL or we use the proxy
          }
        });
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log('Autoplay prevented', e));
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setError('Ошибка загрузки потока видео');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('Autoplay prevented', e));
        });
      }
    } else {
      // Direct MP4 or unknown format
      video.src = proxyUrl;
      video.play().catch(e => console.log('Autoplay prevented', e));
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoInfo]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      {/* Top Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity">
        <button 
          onClick={() => navigate(-1)}
          className="text-white flex items-center gap-2 hover:text-primary transition-colors font-semibold"
        >
          <ArrowLeft size={24} /> Назад
        </button>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="font-semibold text-lg">Загрузка плеера...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
            <div className="bg-red-500/20 text-red-500 p-4 rounded-xl border border-red-500/50 text-center max-w-md">
              <p className="font-bold mb-2">Ошибка воспроизведения</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Вернуться
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          playsInline
        />
      </div>
    </div>
  );
}
