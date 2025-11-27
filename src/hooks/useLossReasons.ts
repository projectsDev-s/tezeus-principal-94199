import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LossReason {
  id: string;
  name: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export const useLossReasons = (workspaceId: string | null) => {
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchLossReasons = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loss_reasons')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setLossReasons(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar motivos de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os motivos de perda',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createLossReason = async (name: string) => {
    if (!workspaceId) return null;

    try {
      const { data, error } = await supabase
        .from('loss_reasons')
        .insert({
          name,
          workspace_id: workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchLossReasons();
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda criado com sucesso',
      });
      
      return data;
    } catch (error: any) {
      console.error('Erro ao criar motivo de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o motivo de perda',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateLossReason = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('loss_reasons')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      await fetchLossReasons();
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda atualizado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao atualizar motivo de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o motivo de perda',
        variant: 'destructive',
      });
    }
  };

  const deleteLossReason = async (id: string) => {
    try {
      const { error } = await supabase
        .from('loss_reasons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchLossReasons();
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda excluído com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao excluir motivo de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o motivo de perda',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchLossReasons();
  }, [workspaceId]);

  return {
    lossReasons,
    isLoading,
    fetchLossReasons,
    createLossReason,
    updateLossReason,
    deleteLossReason,
  };
};
