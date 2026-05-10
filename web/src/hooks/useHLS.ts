import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';

interface HLSError {
  fatal: boolean;
  type: string;
  details?: string;
}

interface UseHLSOptions {
  onError?: (error: HLSError) => void;
  onManifestParsed?: () => void;
  autoplay?: boolean;
}

/**
 * Safely attempt to play video, handling autoplay restrictions.
 * Silently ignores expected autoplay prevention errors.
 */
async function safePlayVideo(video: HTMLVideoElement): Promise<void> {
  if (!video || !video.paused) return;

  try {
    await video.play();
  } catch (err) {
    // Silently ignore expected autoplay errors
    if (err instanceof DOMException) {
      const expectedErrors = ['NotAllowedError', 'AbortError', 'NotSupportedError'];
      if (expectedErrors.includes(err.name)) {
        return;
      }
    }
    // Only log unexpected errors
    console.warn('Unexpected video play error:', err);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Create a patched loader that handles proxy URLs correctly.
 * Uses 'any' to avoid complex HLS.js internal type issues.
 */
function createPatchedLoaderClass(BaseLoader: new (...args: any[]) => any, apiBaseUrl: string): new (...args: any[]) => any {
  return class PatchedLoader extends BaseLoader {
    load(context: { url: string; responseType: string; [key: string]: unknown }, config: unknown, callbacks: { onSuccess: (response: { data: unknown; [key: string]: unknown }, ...args: unknown[]) => void; [key: string]: unknown }) {
      // Patch segment URLs that start with /api/proxy
      if (context.url.startsWith('/api/proxy')) {
        context.url = `${apiBaseUrl}${context.url}`;
      }

      // Patch manifest content
      if (context.responseType === 'text' && context.url.includes('.m3u8')) {
        const originalOnSuccess = callbacks.onSuccess;
        callbacks.onSuccess = (response: { data: unknown; [key: string]: unknown }, ...args: unknown[]) => {
          if (typeof response.data === 'string') {
            response.data = response.data.replace(
              /(\n|^)\/api\/proxy\?/g,
              `$1${apiBaseUrl}/api/proxy?`
            );
          }
          originalOnSuccess(response, ...args);
        };
      }

      super.load(context, config, callbacks);
    }
  };
}

/**
 * Initialize HLS for a video element with the given source URL.
 * This function manages the full lifecycle including native HLS fallback.
 * 
 * Returns a cleanup function and the HLS instance (if created).
 */
export function initializeHLS(
  video: HTMLVideoElement,
  sourceUrl: string,
  options: UseHLSOptions = {}
): { destroy: () => void; hls: Hls | null } {
  const { onError, onManifestParsed, autoplay = true } = options;

  // State flags (local to this instance) - prevents duplicate cleanup
  let isDestroyed = false;
  let isAttached = false;
  let isCleaningUp = false;
  let hlsInstance: Hls | null = null;

  // Check for native HLS support (Safari)
  const canPlayNativeHLS = video.canPlayType('application/vnd.apple.mpegurl') !== '';
  const isNativeHLS = !Hls.isSupported() && canPlayNativeHLS;

  // Cleanup function with safety checks
  const destroy = () => {
    // Prevent multiple simultaneous cleanups
    if (isCleaningUp || isDestroyed) return;
    isCleaningUp = true;

    try {
      // Stop video playback first
      if (video && !video.paused) {
        video.pause();
      }

      // Clear video source to stop buffering
      if (video && !isNativeHLS) {
        video.removeAttribute('src');
        video.load(); // Triggers emptied event, stops all network activity
      }

      // HLS cleanup with proper sequence: detach before destroy
      if (hlsInstance && !isDestroyed) {
        try {
          // Remove all event listeners first
          hlsInstance.off(Hls.Events.MEDIA_ATTACHED);
          hlsInstance.off(Hls.Events.MEDIA_DETACHED);
          hlsInstance.off(Hls.Events.MANIFEST_PARSED);
          hlsInstance.off(Hls.Events.ERROR);

          // Detach media if still attached
          if (isAttached) {
            try {
              hlsInstance.detachMedia();
            } catch {
              // Already detached or not attached - ignore
            }
          }

          // Destroy the instance
          hlsInstance.destroy();
        } catch (e) {
          // Ignore cleanup errors - instance may already be partially destroyed
          console.warn('HLS cleanup warning (non-critical):', e);
        }
      }

      // Remove native event listeners
      if (isNativeHLS) {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    } finally {
      hlsInstance = null;
      isDestroyed = true;
      isAttached = false;
      isCleaningUp = false;
    }
  };

  // Handle loaded metadata for native HLS
  const handleLoadedMetadata = () => {
    if (isDestroyed) return;
    if (onManifestParsed) onManifestParsed();
    if (autoplay) safePlayVideo(video);
  };

  // Native HLS support (Safari)
  if (isNativeHLS) {
    video.src = sourceUrl;
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return { destroy, hls: null };
  }

  // HLS.js support
  if (Hls.isSupported()) {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://animira.onrender.com';

    // Create patched loader class (typed as any to avoid HLS.js internal type issues)
    const PatchedLoader = createPatchedLoaderClass(
      Hls.DefaultConfig.loader as new (...args: unknown[]) => unknown,
      API_BASE_URL
    );

    // Create HLS instance with TV/low-end optimizations
    hlsInstance = new Hls({
      loader: PatchedLoader as never,
      // Buffer settings for TV devices
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      // Network timeouts for reliability
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 3,
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 3,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 4,
    });

    // Track attachment state
    hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
      if (!isDestroyed) isAttached = true;
    });

    hlsInstance.on(Hls.Events.MEDIA_DETACHED, () => {
      isAttached = false;
    });

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      if (!isDestroyed) {
        if (onManifestParsed) onManifestParsed();
        if (autoplay) safePlayVideo(video);
      }
    });

    hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
      if (isDestroyed || isCleaningUp) return;

      if (data.fatal) {
        onError?.({
          fatal: true,
          type: data.type,
          details: data.details,
        });
      }
    });

    // Attach and load
    hlsInstance.loadSource(sourceUrl);
    hlsInstance.attachMedia(video);

    return { destroy, hls: hlsInstance };
  }

  // No HLS support - try direct playback
  video.src = sourceUrl;
  if (autoplay) {
    safePlayVideo(video);
  }

  return { destroy, hls: null };
}

/**
 * React hook for HLS video playback with proper lifecycle management.
 * 
 * Usage:
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null);
 * const hls = useHLS(videoRef, 'https://example.com/stream.m3u8', {
 *   onError: (err) => console.error('HLS error:', err),
 *   autoplay: true,
 * });
 * ```
 */
export function useHLS(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  sourceUrl: string | null | undefined,
  options: UseHLSOptions = {}
): { hls: Hls | null; isReady: boolean } {
  const hlsRef = useRef<Hls | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const [isReady, setIsReady] = useState(false);


  const cleanup = useCallback(() => {
    if (destroyRef.current) {
      destroyRef.current();
      destroyRef.current = null;
    }
    hlsRef.current = null;
    if (isMountedRef.current) {
      setIsReady(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const video = videoRef.current;

    if (!video || !sourceUrl) {
      cleanup();
      return;
    }

    // Initialize HLS
    const { hls, destroy } = initializeHLS(video, sourceUrl, {
      ...options,
      onManifestParsed: () => {
        if (isMountedRef.current) {
          setIsReady(true);
          options.onManifestParsed?.();
        }
      },
    });

    hlsRef.current = hls;
    destroyRef.current = destroy;

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [sourceUrl, cleanup]); // Intentionally minimal deps - sourceUrl change triggers re-init

  return { hls: hlsRef.current, isReady };
}
