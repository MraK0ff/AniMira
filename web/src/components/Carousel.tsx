import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Carousel({ title, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth + 100 : clientWidth - 100;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group mb-10">
      <h2 className="text-2xl font-bold text-white mb-4 px-6 md:px-12">{title}</h2>
      
      <div className="relative">
        {/* Left Button */}
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 w-12 z-20 flex items-center justify-center bg-gradient-to-r from-bg-base to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft size={36} className="text-white hover:scale-125 transition-transform" />
        </button>

        {/* Scroll Container */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto hide-scrollbar px-6 md:px-12 pb-4 scroll-smooth"
        >
          {children}
        </div>

        {/* Right Button */}
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 w-12 z-20 flex items-center justify-center bg-gradient-to-l from-bg-base to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight size={36} className="text-white hover:scale-125 transition-transform" />
        </button>
      </div>
    </div>
  );
}
