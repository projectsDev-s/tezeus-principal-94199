import React from 'react';
import * as LucideIcons from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

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
    <div className={cn("flex items-center justify-center py-12 px-8", className)}>
      {columns.map((column, index) => {
        const IconComponent = (column.icon && LucideIcons[column.icon as keyof typeof LucideIcons]) as LucideIcon;
        const Icon = IconComponent || LucideIcons.Circle;
        
        const isPast = currentIndex !== -1 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = currentIndex !== -1 && index > currentIndex;
        
        // Determina o gradiente da linha baseado nos estados
        const nextColumn = columns[index + 1];
        let lineClass = '';
        let lineStyle: React.CSSProperties = {};
        
        if (index < columns.length - 1) {
          const nextIndex = index + 1;
          const isNextPast = currentIndex !== -1 && nextIndex < currentIndex;
          const isNextCurrent = nextIndex === currentIndex;
          
          if (isPast && isNextPast) {
            // Ambos completados - linha sólida escura
            lineStyle = { background: 'hsl(var(--muted-foreground))' };
          } else if (isPast && isNextCurrent) {
            // De completado para atual - gradiente para verde
            lineStyle = { background: `linear-gradient(to right, hsl(var(--muted-foreground)), ${column.color})` };
          } else if (isCurrent && !isNextPast) {
            // De atual para futuro - gradiente para cinza
            lineStyle = { background: `linear-gradient(to right, ${column.color}, hsl(var(--border)))` };
          } else {
            // Linha padrão cinza
            lineStyle = { background: 'hsl(var(--border))' };
          }
        }

        return (
          <React.Fragment key={column.id}>
            <div className="flex flex-col items-center relative" style={{ minWidth: '80px' }}>
              {/* Ícone grande acima */}
              <div 
                className={cn(
                  "absolute -top-14 transition-all duration-200",
                  isCurrent && "scale-105"
                )}
                style={{
                  color: isPast || isCurrent ? (isPast ? 'hsl(var(--muted-foreground))' : column.color) : 'hsl(var(--muted))',
                }}
              >
                <Icon className="h-10 w-10" strokeWidth={2} />
              </div>
              
              {/* Círculo do step */}
              <div className="relative flex items-center justify-center">
                {isPast && (
                  // Step completado com checkmark
                  <div
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-200"
                    style={{ backgroundColor: 'hsl(var(--muted-foreground))' }}
                  >
                    <LucideIcons.Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </div>
                )}
                
                {isCurrent && (
                  // Step atual com loading spinner
                  <div
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-200"
                    style={{ backgroundColor: column.color }}
                  >
                    <Loader2 className="h-2.5 w-2.5 text-white animate-spin" strokeWidth={3} />
                  </div>
                )}
                
                {isFuture && (
                  // Step futuro - círculo vazio com borda
                  <div
                    className="w-[15px] h-[15px] rounded-full transition-all duration-200"
                    style={{ 
                      border: '4px solid hsl(var(--border))',
                      backgroundColor: 'transparent'
                    }}
                  />
                )}
              </div>

              {/* Label abaixo */}
              <span
                className={cn(
                  "absolute top-8 text-xs font-bold text-center max-w-[100px] transition-all duration-200 whitespace-nowrap",
                  isPast && "text-muted-foreground",
                  isFuture && "text-muted"
                )}
                style={isCurrent ? { color: column.color } : {}}
              >
                {column.name}
              </span>
            </div>

            {/* Linha conectora com gradientes */}
            {index < columns.length - 1 && (
              <div 
                className="h-0.5 transition-all duration-200" 
                style={{ 
                  width: '120px',
                  maxWidth: '120px',
                  flexGrow: 1,
                  ...lineStyle
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
