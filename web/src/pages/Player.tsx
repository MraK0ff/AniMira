import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideoInfo } from '../api/client';
import Hls from 'hls.js';
import {
  ArrowLeft, Loader2, Settings, ChevronLeft, ChevronRight, List,
  Play, Pause, RotateCcw, RotateCw, Maximize, Minimize,
  Unlock, Lock, Sparkles
} from 'lucide-react';
import { Episode } from '../types/api';
import clsx from 'clsx';
import { useAnime4K } from '../hooks/useAnime4K';
import { initializeHLS } from '../hooks/useHLS';
import { usePlayerKeyboard } from '../hooks/usePlayerKeyboard';
import EpisodeOverlay from '../components/EpisodeOverlay';
import Anime4KPanel from '../components/Anime4KPanel';
import { PlayerButton, QualitySelector, ProgressBar } from '../components/player';

// Extract episode number from title string for sorting
function extractEpisodeNumber(title: string): number | null {
  const patterns = [
    /[-\s]\s*(\d+)\s*\[/,      // " - 05 [" or "- 5 ["
    /\s(\d{2,3})\s*\[/,         // " 05 [" or " 108 ["
    /серия\s*(\d+)/i,           // "серия 05" or "серия 5"
    /episode\s*(\d+)/i,        // "episode 05"
    /ep\s*(\d+)/i,             // "ep 5"
    /\s(\d+)\s*\.\s*(mp4|mkv|avi)/i,  // " 05.mp4"
    /\[(\d{2,3})\]/,            // "[05]"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 1000) return num;
    }
  }
  return null;
}

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const source = searchParams.get('source');
  const fallbackEpisodeUrl = searchParams.get('episode_url');
  const torrserveUrl = searchParams.get('torrserve_url');
  
  const episode = location.state?.episode as Episode | undefined;
  const episodes = location.state?.episodes as Episode[] | undefined;
  
  // Flag to indicate this is a TorrServe stream
  const isTorrserveMode = !!torrserveUrl;
  
  const [currentEpisode, setCurrentEpisode] = useState<Episode | undefined>(episode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const anime4kCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showAnime4K, setShowAnime4K] = useState(false);
  
  // Initialize Anime4K
  const anime4k = useAnime4K(videoRef, anime4kCanvasRef);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deduplicate episodes for consistent display
  const uniqueEpisodes = useMemo(() => {
    if (!episodes || episodes.length === 0) return [];

    const groups = new Map<string, Episode[]>();
    episodes.forEach((ep) => {
      const key = ep.uniq || ep.title;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(ep);
    });

    // Select first episode from each group (all have same content, different qualities)
    const unique: Episode[] = [];
    groups.forEach((group) => {
      if (group.length > 0) {
        unique.push(group[0]);
      }
    });

    // Sort by episode number if possible
    return unique.sort((a, b) => {
      const numA = extractEpisodeNumber(a.uniq || a.title);
      const numB = extractEpisodeNumber(b.uniq || b.title);
      if (numA && numB) return numA - numB;
      return 0;
    });
  }, [episodes]);

  const currentIndex = useMemo(() => {
    if (!currentEpisode || uniqueEpisodes.length === 0) return -1;
    return uniqueEpisodes.findIndex(
      (ep) => ep.url === currentEpisode.url ||
              (ep.uniq && ep.uniq === currentEpisode.uniq) ||
              (ep.title === currentEpisode.title)
    );
  }, [currentEpisode, uniqueEpisodes]);

  // Build qualities array - main url is 1080p, url720 is 720p, url360 is 480p
  const qualities = useMemo(() => {
    const q: { name: string; url: string }[] = [];
    // Main url (1080p) should be first
    if (currentEpisode?.url) q.push({ name: '1080p', url: currentEpisode.url });
    if (currentEpisode?.url720) q.push({ name: '720p', url: currentEpisode.url720 });
    if (currentEpisode?.url360) q.push({ name: '480p', url: currentEpisode.url360 });
    if (currentEpisode?.links) {
      currentEpisode.links.forEach(l => {
        if (!q.some(existing => existing.url === l.url)) q.push(l);
      });
    }
    if (q.length === 0 && fallbackEpisodeUrl) {
      q.push({ name: 'Default', url: fallbackEpisodeUrl });
    }
    return q;
  }, [currentEpisode, fallbackEpisodeUrl]);

  const [activeUrl, setActiveUrl] = useState<string>(qualities[0]?.url || fallbackEpisodeUrl!);

  // Sync activeUrl when qualities list changes (e.g. user manually changed URL params)
  useEffect(() => {
    if (qualities.length > 0 && !qualities.some(q => q.url === activeUrl)) {
      setActiveUrl(qualities[0].url);
    }
  }, [qualities, activeUrl]);

  // Update URL params when currentEpisode changes
  useEffect(() => {
    if (currentEpisode && source) {
      const params = new URLSearchParams(searchParams);
      params.set('episode_url', currentEpisode.url);
      navigate(`/player?${params.toString()}`, { 
        state: { ...location.state, episode: currentEpisode },
        replace: true 
      });
    }
  }, [currentEpisode, source]);

  const { data: videoInfo, isLoading: isApiLoading } = useQuery({
    queryKey: ['video', source, activeUrl],
    queryFn: () => getVideoInfo(source!, activeUrl),
    enabled: !!source && !!activeUrl && !isTorrserveMode
  });

  // In TorrServe mode, we're not loading from API
  const isLoading = isTorrserveMode ? false : isApiLoading;

  // Cleanup ref to track HLS destroy function
  const hlsCleanupRef = useRef<(() => void) | null>(null);
  const isPlayerMountedRef = useRef(true);

  // Unified HLS initialization for both videoInfo and TorrServe modes
  useEffect(() => {
    // Set mounted flag
    isPlayerMountedRef.current = true;

    // Determine the video URL to use
    let videoUrl: string | null = null;

    if (torrserveUrl) {
      // TorrServe mode: use the URL directly
      videoUrl = decodeURIComponent(torrserveUrl);
    } else if (videoInfo) {
      // API mode: route through proxy
      const headers = {
        ...(videoInfo.headers || {}),
        Referer: videoInfo.referer || videoInfo.headers?.Referer || ''
      };
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://animira.onrender.com';
      videoUrl = `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(videoInfo.url)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
    }

    if (!videoUrl || !videoRef.current || !isPlayerMountedRef.current) {
      return;
    }

    const video = videoRef.current;

    // Initialize HLS with safe lifecycle management
    const { destroy, hls } = initializeHLS(video, videoUrl, {
      autoplay: true,
      onError: (err) => {
        if (!isPlayerMountedRef.current) return;
        if (err.fatal) {
          if (torrserveUrl) {
            setError('Ошибка загрузки потока от TorrServe');
          } else if (err.type === (Hls as unknown as { ErrorTypes: { NETWORK_ERROR: string } }).ErrorTypes?.NETWORK_ERROR) {
            setError('Ошибка сети при загрузке видео');
          } else if (err.type === (Hls as unknown as { ErrorTypes: { MEDIA_ERROR: string } }).ErrorTypes?.MEDIA_ERROR) {
            setError('Ошибка декодирования видео');
          } else {
            setError('Ошибка загрузки потока видео');
          }
        }
      },
    });

    // Store cleanup function
    hlsCleanupRef.current = destroy;

    return () => {
      isPlayerMountedRef.current = false;
      if (hlsCleanupRef.current) {
        hlsCleanupRef.current();
        hlsCleanupRef.current = null;
      }
    };
  }, [videoInfo, torrserveUrl]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  // Controls auto-hide
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!isLocked) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isLocked]);

  useEffect(() => {
    if (showControls) {
      resetControlsTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, resetControlsTimeout]);

  // Control functions with safe async handling
  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (err) {
      // Silently ignore autoplay prevention
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
          return;
        }
      }
      console.warn('Toggle play error:', err);
    }
  }, []);

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcuts
  usePlayerKeyboard({
    onTogglePlay: togglePlay,
    onSeekForward: skip,
    onSeekBackward: (s) => skip(-s),
    onToggleFullscreen: toggleFullscreen,
    onVolumeUp: () => {
      const video = videoRef.current;
      if (video) video.volume = Math.min(1, video.volume + 0.1);
    },
    onVolumeDown: () => {
      const video = videoRef.current;
      if (video) video.volume = Math.max(0, video.volume - 0.1);
    },
    onNextEpisode: () => {
      const nextEp = uniqueEpisodes[currentIndex + 1];
      if (nextEp) setCurrentEpisode(nextEp);
    },
    onPrevEpisode: () => {
      const prevEp = uniqueEpisodes[currentIndex - 1];
      if (prevEp) setCurrentEpisode(prevEp);
    },
    onShowEpisodes: () => {
      if (uniqueEpisodes.length > 1) {
        setShowEpisodes(!showEpisodes);
        setShowAnime4K(false);
        setShowSettings(false);
      }
    },
    enabled: !isLocked,
  });

  const handleMouseMove = () => {
    setShowControls(true);
    resetControlsTimeout();
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-[100] flex flex-col"
      onMouseMove={handleMouseMove}
      onClick={() => !isLocked && setShowControls(true)}
    >
      {/* Top Bar Overlay */}
      <div className={clsx(
        "absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-all duration-300",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        <div className="flex items-start justify-between p-4 sm:p-6">
          {/* Left: Back + Title */}
          <div className="flex items-start gap-4">
            <PlayerButton
              onClick={() => navigate(-1)}
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={28} />}
              className="flex-shrink-0"
            />
            
            <div className="flex flex-col">
              <h1 className="text-white font-semibold text-lg sm:text-xl drop-shadow-lg line-clamp-2">
                {isTorrserveMode ? 'Поток от TorrServe' : (currentEpisode?.title || 'Плеер')}
              </h1>
              {!isTorrserveMode && uniqueEpisodes.length > 1 && (
                <p className="text-white/70 text-sm mt-1">
                  Серия {currentIndex >= 0 ? currentIndex + 1 : '?'} из {uniqueEpisodes.length}
                </p>
              )}
              {isTorrserveMode && (
                <p className="text-white/50 text-sm mt-1">
                  Торрент-стриминг
                </p>
              )}
            </div>
          </div>

          {/* Right: Lock only */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Lock */}
            <PlayerButton
              onClick={() => setIsLocked(!isLocked)}
              variant="ghost"
              size="sm"
              icon={isLocked ? <Lock size={20} /> : <Unlock size={20} />}
              title={isLocked ? "Разблокировать" : "Заблокировать"}
            />
          </div>
        </div>
      </div>

      {/* Episode Overlay - hidden in TorrServe mode */}
      {!isTorrserveMode && (
        <EpisodeOverlay
          isOpen={showEpisodes}
          episodes={episodes || []}
          currentEpisode={currentEpisode}
          isPlaying={isPlaying}
          onClose={() => setShowEpisodes(false)}
          onSelect={(ep) => {
            setCurrentEpisode(ep);
            setShowEpisodes(false);
          }}
        />
      )}

      {/* Center Controls Overlay */}
      <div
        className={clsx(
          "absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) togglePlay();
        }}
      >
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Rewind 10s */}
          <PlayerButton
            onClick={() => skip(-10)}
            size="lg"
            icon={<RotateCcw size={24} />}
            sublabel="10"
          />

          {/* Previous Episode - hidden in TorrServe mode */}
          {!isTorrserveMode && uniqueEpisodes.length > 1 && (
            <PlayerButton
              onClick={() => {
                const prevEp = uniqueEpisodes[currentIndex - 1];
                if (prevEp) setCurrentEpisode(prevEp);
              }}
              disabled={currentIndex <= 0}
              icon={<ChevronLeft size={28} />}
            />
          )}

          {/* Play/Pause - Big Red Circle */}
          <PlayerButton
            onClick={togglePlay}
            size="xl"
            variant="primary"
            icon={isPlaying ? <Pause size={36} /> : <Play size={36} className="ml-1" />}
            className="hover:scale-105"
          />

          {/* Next Episode - hidden in TorrServe mode */}
          {!isTorrserveMode && uniqueEpisodes.length > 1 && (
            <PlayerButton
              onClick={() => {
                const nextEp = uniqueEpisodes[currentIndex + 1];
                if (nextEp) setCurrentEpisode(nextEp);
              }}
              disabled={currentIndex >= uniqueEpisodes.length - 1}
              icon={<ChevronRight size={28} />}
            />
          )}

          {/* Forward 10s */}
          <PlayerButton
            onClick={() => skip(10)}
            size="lg"
            icon={<RotateCw size={24} />}
            sublabel="10"
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={clsx(
        "absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <div className="p-4 sm:p-6">
          {/* Progress Bar */}
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            formatTime={formatTime}
          />

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Episodes Toggle - hidden in TorrServe mode */}
              {!isTorrserveMode && uniqueEpisodes.length > 1 && (
                <PlayerButton
                  onClick={() => {
                    setShowEpisodes(!showEpisodes);
                    setShowAnime4K(false);
                    setShowSettings(false);
                  }}
                  shape="pill"
                  active={showEpisodes}
                  className={showEpisodes ? 'bg-primary' : ''}
                  icon={<List size={18} />}
                  label="Серии"
                />
              )}
              
              {/* Quality Selector - hidden in TorrServe mode */}
              {!isTorrserveMode && qualities.length > 1 && (
                <div className="relative">
                  <PlayerButton
                    onClick={() => {
                      setShowSettings(!showSettings);
                      setShowEpisodes(false);
                      setShowAnime4K(false);
                    }}
                    shape="pill"
                    active={showSettings}
                    icon={<Settings size={18} />}
                    label={qualities.find(q => q.url === activeUrl)?.name || 'Качество'}
                  />

                  <QualitySelector
                    isOpen={showSettings}
                    qualities={qualities}
                    activeUrl={activeUrl}
                    onClose={() => setShowSettings(false)}
                    onSelect={setActiveUrl}
                  />
                </div>
              )}

              {/* Anime4K Toggle */}
              <PlayerButton
                onClick={() => {
                  setShowAnime4K(!showAnime4K);
                  setShowEpisodes(false);
                  setShowSettings(false);
                }}
                shape="pill"
                active={showAnime4K}
                className={clsx(
                  anime4k.enabled ? "bg-purple-500" : "",
                  showAnime4K && "ring-2 ring-purple-400"
                )}
                icon={<Sparkles size={18} />}
                label={anime4k.enabled ? '4K' : 'Anime4K'}
              />
              
              <Anime4KPanel
                isOpen={showAnime4K}
                enabled={anime4k.enabled}
                mode={anime4k.mode}
                quality={anime4k.quality}
                isSupported={anime4k.isSupported}
                onClose={() => setShowAnime4K(false)}
                onToggle={() => anime4k.setEnabled(!anime4k.enabled)}
                onSetMode={anime4k.setMode}
                onSetQuality={anime4k.setQuality}
              />
            </div>

            {/* Fullscreen */}
            <PlayerButton
              onClick={toggleFullscreen}
              variant="ghost"
              size="sm"
              icon={isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            />
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white z-10">
            <Loader2 size={48} className="animate-spin text-gray-500" />
            <p className="font-semibold text-lg">Загрузка плеера...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white z-10">
            <div className="bg-gray-500/20 text-gray-400 p-4 rounded-xl border border-gray-500/50 text-center max-w-md">
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

        {/* Anime4K WebGL Canvas */}
        <canvas
          ref={anime4kCanvasRef}
          className={clsx(
            "absolute inset-0 w-full h-full object-contain",
            anime4k.enabled ? "z-[5]" : "z-0 pointer-events-none opacity-0"
          )}
        />

        <video
          ref={videoRef}
          className={clsx(
            "w-full h-full",
            anime4k.enabled ? "opacity-0 absolute inset-0" : "relative z-0"
          )}
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          x5-video-orientation="portraint"
        />
      </div>
    </div>
  );
}
