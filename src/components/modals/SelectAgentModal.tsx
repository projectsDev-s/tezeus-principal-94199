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
        .select('agente_ativo')
        .eq('id', conversationId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && open,
  });

  // Atualizar selectedAgentId quando carregar a conversa
  useEffect(() => {
    // Por enquanto, sem agent_id na tabela, usar agente padrão do workspace
    if (conversation?.agente_ativo) {
      // Quando tiver agent_id, usar aqui
      setSelectedAgentId('default');
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
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: true
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      
      // Snapshot do valor anterior
      const previousConversation = queryClient.getQueryData(['conversation', conversationId]);
      
      // Atualização otimista
      queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
        ...old,
        agente_ativo: true
      }));
      
      return { previousConversation };
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
    onError: (error, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousConversation) {
        queryClient.setQueryData(['conversation', conversationId], context.previousConversation);
      }
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
          agente_ativo: false
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      
      // Snapshot do valor anterior
      const previousConversation = queryClient.getQueryData(['conversation', conversationId]);
      
      // Atualização otimista
      queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
        ...old,
        agente_ativo: false
      }));
      
      return { previousConversation };
    },
    onSuccess: () => {
      toast({
        title: 'Agente Desativado',
        description: 'O agente não irá mais interagir nessa conversa',
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      onOpenChange(false);
    },
    onError: (error, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousConversation) {
        queryClient.setQueryData(['conversation', conversationId], context.previousConversation);
      }
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

  const isAgentActive = conversation?.agente_ativo;
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
                    {agents?.[0]?.name || 'Agente IA'}
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
