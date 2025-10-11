import { Smartphone } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConnectionInfo {
  instance_name: string;
  phone_number?: string;
  status: string;
}

interface ConnectionBadgeProps {
  connectionId?: string;
  connectionInfo?: {
    instance_name: string;
    phone_number?: string;
    status: string;
  };
  iconOnly?: boolean;
}

export function ConnectionBadge({ connectionId, connectionInfo: propConnectionInfo, iconOnly = false }: ConnectionBadgeProps) {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(propConnectionInfo || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se já tem dados via props, não busca nada
    if (propConnectionInfo) {
      setConnectionInfo(propConnectionInfo);
      return;
    }

    // Fallback: busca apenas se não tiver dados
    if (!connectionId) {
      return;
    }

    const fetchConnectionInfo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('instance_name, phone_number, status')
          .eq('id', connectionId)
          .single();

        if (error) throw error;
        setConnectionInfo(data);
      } catch (error) {
        console.error('Error fetching connection info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectionInfo();
  }, [connectionId, propConnectionInfo]);

  if (!connectionInfo || loading) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'connected':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'creating':
      case 'connecting':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      case 'closed':
      case 'disconnected':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
      case 'connected':
        return 'Conectado';
      case 'creating':
        return 'Criando';
      case 'connecting':
        return 'Conectando';
      case 'closed':
      case 'disconnected':
        return 'Desconectado';
      default:
        return status;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="flex items-center gap-1 h-5 px-1.5 cursor-pointer hover:bg-muted transition-colors"
          >
            <Smartphone className="w-3 h-3" />
            {!iconOnly && (
              <span className="text-[10px] font-medium">
                {connectionInfo?.instance_name?.slice(0, 8)}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold">Instância WhatsApp</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {connectionInfo?.instance_name || 'N/A'}
              </p>
            </div>
            {connectionInfo?.phone_number && (
              <div>
                <p className="text-xs font-semibold">Número</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {connectionInfo.phone_number}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold">Status</p>
              <Badge 
                variant="outline" 
                className={`mt-1 text-[10px] ${getStatusColor(connectionInfo?.status || '')}`}
              >
                {getStatusLabel(connectionInfo?.status || '')}
              </Badge>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
