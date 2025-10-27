import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { Bot } from 'lucide-react';

interface SelectAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export const SelectAgentModal = ({ open, onOpenChange, conversationId }: SelectAgentModalProps) => {
  const { selectedWorkspace } = useWorkspace();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('none');
  const queryClient = useQueryClient();

  // Buscar dados da conversa
  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const { data, error } = await supabase
        .from('conversations')
        .select('agent_id, agente_ativo')
        .eq('id', conversationId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && open,
  });

  // Atualizar selectedAgentId quando carregar a conversa
  useEffect(() => {
    if (conversation?.agent_id) {
      setSelectedAgentId(conversation.agent_id);
    } else {
      setSelectedAgentId('none');
    }
  }, [conversation]);

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['workspace-agents', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace?.workspace_id && open,
  });

  const activateAgentMutation = useMutation({
    mutationFn: async () => {
      const agentIdValue = selectedAgentId === 'none' ? null : selectedAgentId;
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agent_id: agentIdValue,
          agente_ativo: !!agentIdValue
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Agente ativado',
        description: 'Agente IA ativado para esta conversa',
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao ativar agente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível ativar o agente',
        variant: 'destructive',
      });
    },
  });

  const deactivateAgentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agent_id: null,
          agente_ativo: false
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Agente desativado',
        description: 'Agente IA desativado para esta conversa',
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao desativar agente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desativar o agente',
        variant: 'destructive',
      });
    },
  });

  const handleActivate = () => {
    if (selectedAgentId === 'none') {
      toast({
        title: 'Atenção',
        description: 'Selecione um agente para ativar',
        variant: 'destructive',
      });
      return;
    }
    activateAgentMutation.mutate();
  };

  const handleDeactivate = () => {
    deactivateAgentMutation.mutate();
  };

  const isAgentActive = conversation?.agente_ativo && conversation?.agent_id;
  const isLoading = isLoadingConversation || isLoadingAgents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {isAgentActive ? 'Agente IA Ativo' : 'Ativar Agente IA'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!isAgentActive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione o agente</label>
              <Select 
                value={selectedAgentId} 
                onValueChange={setSelectedAgentId}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum agente</SelectItem>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAgentActive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Agente ativo</label>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    {agents?.find(a => a.id === conversation.agent_id)?.name || 'Agente IA'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {isAgentActive ? (
              <Button 
                variant="destructive"
                onClick={handleDeactivate} 
                disabled={deactivateAgentMutation.isPending}
              >
                {deactivateAgentMutation.isPending ? 'Desativando...' : 'Desativar'}
              </Button>
            ) : (
              <Button 
                onClick={handleActivate} 
                disabled={activateAgentMutation.isPending}
              >
                {activateAgentMutation.isPending ? 'Ativando...' : 'Ativar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
