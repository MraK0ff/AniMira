import { memo } from 'react';
import { Sparkles, ChevronLeft, X } from 'lucide-react';
import clsx from 'clsx';
import type { Anime4KMode, Anime4KQuality } from '../hooks/useAnime4K';

interface Anime4KPanelProps {
  isOpen: boolean;
  enabled: boolean;
  mode: Anime4KMode;
  quality: Anime4KQuality;
  isSupported: boolean;
  onClose: () => void;
  onToggle: () => void;
  onSetMode: (mode: Anime4KMode) => void;
  onSetQuality: (quality: Anime4KQuality) => void;
}

const modeLabels: Record<Anime4KMode, string> = {
  'OFF': 'Выкл',
  'A': 'A (Восстановление)',
  'B': 'B (Мягкое)',
  'C': 'C (Шумоподавление)',
  'A_PLUS': 'A+ (Улучшенное)',
  'B_PLUS': 'B+ (Мягкое+)',
  'C_PLUS': 'C+ (Гибридное)',
};

const qualityLabels: Record<Anime4KQuality, string> = {
  'S': 'Быстро',
  'M': 'Баланс',
  'L': 'Качество',
};

const modes: Anime4KMode[] = ['OFF', 'A', 'B', 'C', 'A_PLUS', 'B_PLUS', 'C_PLUS'];
const qualities: Anime4KQuality[] = ['S', 'M', 'L'];

function Anime4KPanelInternal({
  isOpen,
  enabled,
  mode,
  quality,
  isSupported,
  onClose,
  onToggle,
  onSetMode,
  onSetQuality,
}: Anime4KPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-20 left-4 sm:left-6 z-30 animate-slide-in-right">
      <div className="w-80 bg-black/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Sparkles size={16} className="text-purple-400" />
            </div>
            <h3 className="text-white/90 text-sm font-bold uppercase tracking-wider">
              Anime4K
            </h3>
          </div>
          <button
            onClick={onClose}
            tabIndex={0}
            className="tv-focusable w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Закрыть"
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Enable Toggle */}
        <div className="px-4 py-3 border-b border-white/10">
          <button
            onClick={onToggle}
            tabIndex={0}
            className="tv-focusable w-full flex items-center justify-between group"
          >
            <div className="text-left">
              <span className="text-white/90 text-sm font-medium">Включить Anime4K</span>
              <p className="text-white/40 text-xs mt-0.5">Апскейлинг аниме с помощью ИИ-шейдеров</p>
              {!isSupported && (
                <p className="text-red-400 text-xs mt-1">WebGL не поддерживается</p>
              )}
            </div>
            <div
              className={clsx(
                'w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ml-3',
                enabled ? 'bg-purple-500' : 'bg-white/20'
              )}
            >
              <span
                className={clsx(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  enabled ? 'left-7' : 'left-1'
                )}
              />
            </div>
          </button>
        </div>

        {/* Mode Selection */}
        <div
          className={clsx(
            'px-4 py-3 border-b border-white/10 transition-opacity',
            !enabled && 'opacity-50 pointer-events-none'
          )}
        >
          <p className="text-white/50 text-xs font-bold uppercase mb-2">Режим</p>
          <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin pr-1">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => onSetMode(m)}
                tabIndex={0}
                className={clsx(
                  'tv-focusable w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all',
                  mode === m
                    ? 'bg-purple-500/30 text-white border border-purple-500/50 shadow-sm shadow-purple-500/20'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Selection */}
        <div
          className={clsx(
            'px-4 py-3 transition-opacity',
            !enabled && 'opacity-50 pointer-events-none'
          )}
        >
          <p className="text-white/50 text-xs font-bold uppercase mb-2">Качество</p>
          <div className="flex gap-2">
            {qualities.map((q) => (
              <button
                key={q}
                onClick={() => onSetQuality(q)}
                tabIndex={0}
                className={clsx(
                  'tv-focusable flex-1 px-3 py-2.5 text-sm rounded-lg transition-all font-medium',
                  quality === q
                    ? 'bg-purple-500/30 text-white border border-purple-500/50 shadow-sm shadow-purple-500/20'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                {qualityLabels[q]}
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 bg-white/5 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            ↑↓ для навигации, Enter для выбора
          </p>
        </div>
      </div>
    </div>
  );
}

export const Anime4KPanel = memo(Anime4KPanelInternal);
export default Anime4KPanel;
