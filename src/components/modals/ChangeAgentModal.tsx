import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Bot, Check, Loader2, Sparkles, Power } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangeAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentAgentId?: string | null;
  onAgentChanged?: () => void;
}

export function ChangeAgentModal({
  open,
  onOpenChange,
  conversationId,
  currentAgentId,
  onAgentChanged
}: ChangeAgentModalProps) {
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(currentAgentId || null);
  const [actualCurrentAgentId, setActualCurrentAgentId] = useState<string | null>(currentAgentId || null);

  // Buscar o agente ativo REAL do banco quando o modal abrir
  useEffect(() => {
    const fetchCurrentAgent = async () => {
      if (!open || !conversationId) return;
      
      console.log('🔄 Modal de agente aberto - Buscando agente atual do banco');
      
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('agent_active_id')
          .eq('id', conversationId)
          .single();
        
        if (error) throw error;
        
        const agentId = data?.agent_active_id || null;
        console.log('✅ Agente atual do banco:', agentId);
        setActualCurrentAgentId(agentId);
        setSelectedAgentId(agentId);
      } catch (error) {
        console.error('❌ Erro ao buscar agente atual:', error);
        setActualCurrentAgentId(null);
        setSelectedAgentId(null);
      }
      
      // Refresh da lista de agentes
      queryClient.invalidateQueries({ queryKey: ['workspace-agents', selectedWorkspace?.workspace_id] });
    };

    fetchCurrentAgent();
  }, [open, conversationId, selectedWorkspace?.workspace_id, queryClient]);

  // Buscar agentes ativos do workspace
  const { data: agents, isLoading } = useQuery({
    queryKey: ['workspace-agents', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, description, is_active')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWorkspace?.workspace_id && open,
  });

  const handleChangeAgent = async () => {
    if (!selectedAgentId) {
      toast({
        title: "❌ Erro",
        description: "Selecione um agente para continuar",
        variant: "destructive",
      });
      return;
    }

    setIsChanging(true);
    try {
      // Buscar nome do agente anterior e do novo agente
      const { data: oldAgentData } = await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', actualCurrentAgentId)
        .single();

      const { data: newAgentData } = await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', selectedAgentId)
        .single();

      // Atualizar o agente ativo da conversa
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agent_active_id: selectedAgentId,
          agente_ativo: true
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Registrar no histórico de agentes
      await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversationId,
          action: 'changed',
          agent_id: selectedAgentId,
          agent_name: newAgentData?.name || 'Novo agente',
          changed_by: (await supabase.auth.getUser()).data.user?.id || null,
          metadata: {
            old_agent_id: actualCurrentAgentId,
            old_agent_name: oldAgentData?.name
          }
        });

      toast({
        title: "✅ Agente trocado",
        description: `Agora usando: ${newAgentData?.name || 'Novo agente'}`,
      });

      // Atualizar dados do modal
      queryClient.invalidateQueries({ queryKey: ['workspace-agents', selectedWorkspace?.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-agent', conversationId] });

      onAgentChanged?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao trocar agente:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível trocar o agente",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  const handleDeactivateAgent = async () => {
    setIsChanging(true);
    try {
      // Buscar nome do agente atual antes de desativar
      const { data: agentData } = await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', actualCurrentAgentId)
        .single();

      // Desativar o agente da conversa
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: false,
          agent_active_id: null
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Registrar no histórico de agentes
      await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversationId,
          action: 'deactivated',
          agent_id: actualCurrentAgentId,
          agent_name: agentData?.name || 'Agente IA',
          changed_by: (await supabase.auth.getUser()).data.user?.id || null
        });

      toast({
        title: "✅ Agente desativado",
        description: "O agente foi desativado com sucesso",
      });

      // Atualizar dados do modal
      queryClient.invalidateQueries({ queryKey: ['workspace-agents', selectedWorkspace?.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-agent', conversationId] });

      onAgentChanged?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao desativar agente:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível desativar o agente",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            {actualCurrentAgentId ? 'Trocar Agente de IA' : 'Ativar Agente de IA'}
          </DialogTitle>
          <DialogDescription>
            {actualCurrentAgentId 
              ? 'Selecione um novo agente para esta conversa. O agente permanecerá ativo.'
              : 'Selecione um agente para ativar nesta conversa.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : agents && agents.length > 0 ? (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {agents.map((agent) => {
                const isCurrentAgent = agent.id === actualCurrentAgentId;
                const isSelected = agent.id === selectedAgentId;

                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    disabled={isCurrentAgent}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 transition-all text-left",
                      isCurrentAgent && "opacity-60 cursor-not-allowed border-muted bg-muted/20",
                      !isCurrentAgent && "hover:border-primary/50 hover:bg-accent/50",
                      !isCurrentAgent && isSelected && "border-primary bg-primary/5",
                      !isCurrentAgent && !isSelected && "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className={cn(
                        "w-10 h-10 transition-all",
                        isSelected && !isCurrentAgent && "ring-2 ring-primary ring-offset-2"
                      )}>
                        <AvatarFallback className={cn(
                          "text-white font-semibold",
                          isSelected && !isCurrentAgent ? "bg-primary" : "bg-muted-foreground"
                        )}>
                          <Bot className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{agent.name}</h4>
                          {isCurrentAgent && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <Sparkles className="w-2.5 h-2.5 mr-1" />
                              Agente Ativo
                            </Badge>
                          )}
                          {isSelected && !isCurrentAgent && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {agent.description}
                          </p>
                        )}
                        {isCurrentAgent && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Este agente já está ativo nesta conversa
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum agente ativo encontrado
            </p>
          </div>
        )}

        <div className="flex justify-between items-center gap-2 mt-4">
          <Button
            variant="destructive"
            onClick={handleDeactivateAgent}
            disabled={isChanging}
          >
            {isChanging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Desativando...
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                Desativar Agente
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isChanging}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangeAgent}
              disabled={isChanging || !selectedAgentId || selectedAgentId === actualCurrentAgentId}
              className={cn(
                selectedAgentId === actualCurrentAgentId && "opacity-50 cursor-not-allowed"
              )}
            >
              {isChanging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Trocando...
                </>
              ) : selectedAgentId === actualCurrentAgentId ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Agente Atual
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {actualCurrentAgentId ? 'Trocar Agente' : 'Ativar Agente'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
