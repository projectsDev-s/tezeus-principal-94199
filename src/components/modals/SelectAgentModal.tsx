import { useState } from 'react';
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
  currentAgentId?: string | null;
}

export const SelectAgentModal = ({ open, onOpenChange, conversationId, currentAgentId }: SelectAgentModalProps) => {
  const { selectedWorkspace } = useWorkspace();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(currentAgentId || 'none');
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
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

  const assignAgentMutation = useMutation({
    mutationFn: async (agentId: string | null) => {
      const agentIdValue = agentId === 'none' ? null : agentId;
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
        title: 'Agente atualizado',
        description: selectedAgentId !== 'none' ? 'Agente ativado para esta conversa' : 'Agente desativado',
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao atribuir agente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atribuir o agente',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    assignAgentMutation.mutate(selectedAgentId === 'none' ? null : selectedAgentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Selecionar Agente IA
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Agente</label>
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={assignAgentMutation.isPending}>
              {assignAgentMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
