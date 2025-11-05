import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Play, Pause, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CronJobMonitor() {
  const [isRunning, setIsRunning] = useState(true);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [nextRun, setNextRun] = useState<Date | null>(null);

  useEffect(() => {
    // Calcular próxima execução (a cada 5 minutos)
    const now = new Date();
    const minutes = now.getMinutes();
    const nextMinutes = Math.ceil(minutes / 5) * 5;
    const next = new Date(now);
    next.setMinutes(nextMinutes);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    if (nextMinutes === minutes) {
      next.setMinutes(next.getMinutes() + 5);
    }
    
    setNextRun(next);

    // Atualizar a cada minuto
    const interval = setInterval(() => {
      const now = new Date();
      const minutes = now.getMinutes();
      const nextMinutes = Math.ceil(minutes / 5) * 5;
      const next = new Date(now);
      next.setMinutes(nextMinutes);
      next.setSeconds(0);
      next.setMilliseconds(0);
      
      if (nextMinutes === minutes) {
        next.setMinutes(next.getMinutes() + 5);
      }
      
      setNextRun(next);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRun = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('monitor-provider-alerts');
      
      if (error) {
        toast.error('Erro ao executar monitoramento');
        return;
      }

      setLastRun(new Date());
      toast.success(`Monitoramento executado: ${data.alerts_triggered} alertas disparados`);
    } catch (error) {
      console.error('Error running monitor:', error);
      toast.error('Erro ao executar monitoramento');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Monitoramento Automático
        </CardTitle>
        <CardDescription>
          Cron job executa verificação de alertas a cada 5 minutos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {isRunning ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Pause className="h-3 w-3" />
                Pausado
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Frequência</p>
            <p className="text-sm font-medium">A cada 5 minutos</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Próxima Execução</p>
            <p className="text-sm font-medium">
              {nextRun ? format(nextRun, 'HH:mm:ss', { locale: ptBR }) : '-'}
            </p>
          </div>

          {lastRun && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Última Execução Manual</p>
              <p className="text-sm font-medium">
                {format(lastRun, "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleManualRun} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Executar Agora
          </Button>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Cron Job Configurado</p>
              <p className="text-muted-foreground">
                O sistema está monitorando automaticamente as taxas de erro dos providers. 
                Quando um threshold for ultrapassado, alertas serão enviados automaticamente.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
