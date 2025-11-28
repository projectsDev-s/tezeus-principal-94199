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
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 border border-[#d4d4d4] bg-white shadow-sm rounded-none">
        <DialogHeader className="bg-primary p-4 rounded-none m-0 border-b border-[#d4d4d4]">
          <DialogTitle className="flex items-center gap-2 text-primary-foreground text-base font-bold">
            <Bot className="w-5 h-5 text-primary-foreground" />
            {actualCurrentAgentId ? 'Trocar Agente de IA' : 'Ativar Agente de IA'}
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80 text-xs">
            {actualCurrentAgentId 
              ? 'Selecione um novo agente para esta conversa. O agente permanecerá ativo.'
              : 'Selecione um agente para ativar nesta conversa.'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents && agents.length > 0 ? (
            <ScrollArea className="max-h-[400px] pr-4 -mr-4">
              <div className="space-y-2 pr-4">
                {agents.map((agent) => {
                  const isCurrentAgent = agent.id === actualCurrentAgentId;
                  const isSelected = agent.id === selectedAgentId;

                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      disabled={isCurrentAgent}
                      className={cn(
                        "w-full p-3 rounded-none border transition-all text-left flex items-start gap-3 bg-white",
                        isCurrentAgent && "opacity-60 cursor-not-allowed border-gray-200 bg-gray-50",
                        !isCurrentAgent && "hover:bg-[#e6f2ff] hover:border-primary/30",
                        !isCurrentAgent && isSelected && "border-primary bg-[#e6f2ff]",
                        !isCurrentAgent && !isSelected && "border-[#d4d4d4]"
                      )}
                    >
                      <Avatar className={cn(
                        "w-8 h-8 transition-all rounded-none",
                        isSelected && !isCurrentAgent && "ring-1 ring-primary ring-offset-1"
                      )}>
                        <AvatarFallback className={cn(
                          "text-white font-bold text-xs rounded-none",
                          isSelected && !isCurrentAgent ? "bg-primary" : "bg-gray-400"
                        )}>
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-xs text-gray-900">{agent.name}</h4>
                          {isCurrentAgent && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-none bg-yellow-100 text-yellow-800 border-yellow-200">
                              <Sparkles className="w-2.5 h-2.5 mr-1" />
                              Agente Ativo
                            </Badge>
                          )}
                          {isSelected && !isCurrentAgent && (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          )}
                        </div>
                        {agent.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                            {agent.description}
                          </p>
                        )}
                        {isCurrentAgent && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">
                            Este agente já está ativo nesta conversa
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">
                Nenhum agente ativo encontrado
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 p-4 bg-gray-50 border-t border-[#d4d4d4] m-0">
          <Button
            variant="destructive"
            onClick={handleDeactivateAgent}
            disabled={isChanging}
            className="h-8 text-xs rounded-none"
          >
            {isChanging ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Desativando...
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5 mr-2" />
                Desativar Agente
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isChanging}
              className="h-8 text-xs rounded-none border-gray-300 bg-white hover:bg-gray-100 text-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangeAgent}
              disabled={isChanging || !selectedAgentId || selectedAgentId === actualCurrentAgentId}
              className={cn(
                "h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground",
                selectedAgentId === actualCurrentAgentId && "opacity-50 cursor-not-allowed"
              )}
            >
              {isChanging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Trocando...
                </>
              ) : selectedAgentId === actualCurrentAgentId ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-2" />
                  Agente Atual
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-2" />
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
