import { cn } from '@/lib/utils';

interface FloatingDateIndicatorProps {
  date: string;
  visible: boolean;
}

export function FloatingDateIndicator({ date, visible }: FloatingDateIndicatorProps) {
  return (
    <div 
      className={cn(
        "fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      )}
    >
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-full px-4 py-1.5 shadow-lg">
        <span className="text-xs font-medium text-foreground capitalize">
          {date}
        </span>
      </div>
    </div>
  );
}
