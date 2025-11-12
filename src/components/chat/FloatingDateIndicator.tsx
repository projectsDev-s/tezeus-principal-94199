import { cn } from '@/lib/utils';

interface FloatingDateIndicatorProps {
  date: string;
  visible: boolean;
}

export function FloatingDateIndicator({ date, visible }: FloatingDateIndicatorProps) {
  return (
    <div 
      className={cn(
        "fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-out",
        visible 
          ? "opacity-100 translate-y-0 scale-100" 
          : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
      )}
    >
      <div 
        className={cn(
          "bg-background/95 backdrop-blur-sm border border-border rounded-full px-4 py-1.5 shadow-lg transition-all duration-300",
          visible && "animate-in fade-in slide-in-from-top-2 zoom-in-95"
        )}
      >
        <span className="text-xs font-medium text-foreground capitalize">
          {date}
        </span>
      </div>
    </div>
  );
}
