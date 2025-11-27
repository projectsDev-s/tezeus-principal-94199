import React from 'react';
import * as LucideIcons from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';

export interface TimelineColumn {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isActive: boolean;
}

interface PipelineTimelineProps {
  columns: TimelineColumn[];
  currentColumnId?: string;
  className?: string;
}

export function PipelineTimeline({ columns, currentColumnId, className }: PipelineTimelineProps) {
  const currentIndex = columns.findIndex(col => col.id === currentColumnId);

  return (
    <div className={cn("flex items-center justify-center gap-0 py-8", className)}>
      {columns.map((column, index) => {
        const IconComponent = (column.icon && LucideIcons[column.icon as keyof typeof LucideIcons]) as LucideIcon;
        const Icon = IconComponent || LucideIcons.Circle;
        
        const isPast = currentIndex !== -1 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = currentIndex !== -1 && index > currentIndex;

        return (
          <React.Fragment key={column.id}>
            <div className="flex flex-col items-center gap-3 relative">
              {/* Círculo do ícone */}
              <div className="relative">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full w-16 h-16 transition-all border-2",
                    isCurrent && "scale-110"
                  )}
                  style={{
                    backgroundColor: isPast || isCurrent ? column.color : 'hsl(var(--muted))',
                    borderColor: isPast || isCurrent ? column.color : 'hsl(var(--border))',
                    color: isPast || isCurrent ? '#ffffff' : 'hsl(var(--muted-foreground))'
                  }}
                >
                  <Icon className="h-7 w-7" strokeWidth={2.5} />
                </div>
                
                {/* Check mark para etapas concluídas */}
                {isPast && (
                  <div
                    className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full w-6 h-6 border-2 border-background"
                    style={{ backgroundColor: column.color }}
                  >
                    <LucideIcons.Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Nome da coluna */}
              <span
                className={cn(
                  "text-sm text-center max-w-[100px] transition-all",
                  isCurrent && "font-semibold text-foreground",
                  isFuture && "text-muted-foreground font-medium",
                  isPast && "text-muted-foreground font-medium"
                )}
                style={isCurrent ? { color: column.color } : {}}
              >
                {column.name}
              </span>
            </div>

            {/* Linha conectora */}
            {index < columns.length - 1 && (
              <div className="flex items-center" style={{ width: '80px', marginTop: '-35px' }}>
                <div
                  className={cn(
                    "h-1 w-full transition-all rounded-full"
                  )}
                  style={{
                    backgroundColor: isPast ? column.color : 'hsl(var(--border))',
                    opacity: isPast ? 1 : 0.3
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
