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
    <div className={cn("flex items-center justify-center gap-2 py-6", className)}>
      {columns.map((column, index) => {
        const IconComponent = (column.icon && LucideIcons[column.icon as keyof typeof LucideIcons]) as LucideIcon;
        const Icon = IconComponent || LucideIcons.Circle;
        
        const isPast = currentIndex !== -1 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = currentIndex !== -1 && index > currentIndex;

        return (
          <React.Fragment key={column.id}>
            <div className="flex flex-col items-center gap-2">
              {/* Ícone */}
              <div
                className={cn(
                  "relative flex items-center justify-center rounded-lg p-3 transition-all",
                  isCurrent && "ring-2 ring-offset-2"
                )}
                style={{
                  backgroundColor: isPast || isCurrent ? column.color : '#e5e7eb',
                  color: isPast || isCurrent ? '#ffffff' : '#9ca3af'
                }}
              >
                <Icon className="h-6 w-6" />
                
                {/* Check mark para etapas concluídas */}
                {isPast && (
                  <div
                    className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full p-1"
                    style={{ backgroundColor: column.color }}
                  >
                    <LucideIcons.Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>

              {/* Nome da coluna */}
              <span
                className={cn(
                  "text-xs font-medium text-center max-w-[80px] transition-all",
                  isCurrent && "text-foreground font-semibold",
                  isFuture && "text-muted-foreground",
                  isPast && "text-foreground"
                )}
              >
                {column.name}
              </span>
            </div>

            {/* Linha conectora */}
            {index < columns.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 transition-all",
                  isPast ? "opacity-100" : "opacity-40"
                )}
                style={{
                  backgroundColor: isPast ? column.color : '#e5e7eb'
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
