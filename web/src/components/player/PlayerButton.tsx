import { memo, type ReactNode } from 'react';
import clsx from 'clsx';

interface PlayerButtonProps {
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'ghost';
  shape?: 'circle' | 'rounded' | 'pill';
  className?: string;
  icon?: ReactNode;
  label?: string;
  sublabel?: string;
  tabIndex?: number;
  title?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10 sm:w-12 sm:h-12',
  lg: 'w-12 h-12 sm:w-14 sm:h-14',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
};

const shapeClasses = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  pill: 'rounded-full px-3',
};

const variantClasses = {
  default: 'bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 text-white',
  primary: 'bg-gray-600/90 hover:bg-gray-500 text-white shadow-lg shadow-gray-900/30',
  ghost: 'hover:bg-white/10 text-white',
};

function PlayerButtonInternal({
  onClick,
  onMouseDown,
  disabled = false,
  active = false,
  size = 'md',
  variant = 'default',
  shape = 'circle',
  className,
  icon,
  label,
  sublabel,
  tabIndex = 0,
  title,
}: PlayerButtonProps) {
  const hasLabel = label || sublabel;

  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      tabIndex={tabIndex}
      title={title}
      className={clsx(
        'tv-focusable transition-all duration-200 flex items-center justify-center',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        'focus:outline-none',
        hasLabel ? 'flex-col gap-1' : '',
        active && 'scale-105',
        shape !== 'pill' && sizeClasses[size],
        shapeClasses[shape],
        variantClasses[variant],
        className
      )}
    >
      {icon && <span className={clsx('flex items-center justify-center', label && 'mb-0.5')}>{icon}</span>}
      {label && <span className="text-xs font-medium text-white/80">{label}</span>}
      {sublabel && <span className="text-xs font-medium text-white/60">{sublabel}</span>}
    </button>
  );
}

export const PlayerButton = memo(PlayerButtonInternal);
export default PlayerButton;
