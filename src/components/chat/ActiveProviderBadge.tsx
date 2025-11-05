import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Radio } from 'lucide-react';
import { useWhatsAppProviders } from '@/hooks/useWhatsAppProviders';
import { cn } from '@/lib/utils';

interface ActiveProviderBadgeProps {
  workspaceId: string;
  className?: string;
}

export function ActiveProviderBadge({ workspaceId, className }: ActiveProviderBadgeProps) {
  const { providers, fetchProviders, isLoading } = useWhatsAppProviders(workspaceId);
  const [activeProvider, setActiveProvider] = useState<'evolution' | 'zapi' | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchProviders();
    }
  }, [workspaceId]);

  useEffect(() => {
    const active = providers.find(p => p.is_active);
    if (active) {
      setActiveProvider(active.provider);
    } else {
      setActiveProvider(null);
    }
  }, [providers]);

  if (isLoading || !activeProvider) {
    return null;
  }

  const isEvolution = activeProvider === 'evolution';
  const providerName = isEvolution ? 'Evolution API' : 'Z-API';
  const providerColor = isEvolution ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20' : 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-500/20';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'gap-1.5 px-2.5 py-1 font-medium transition-all cursor-help',
              providerColor,
              className
            )}
          >
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {providerName}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Provedor WhatsApp Ativo</p>
            <p className="text-xs text-muted-foreground">
              Todas as mensagens estão sendo enviadas via {providerName}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
