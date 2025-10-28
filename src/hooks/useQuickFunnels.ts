import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface FunnelStep {
  type: 'message' | 'audio' | 'media' | 'document';
  item_id: string;
  delay_seconds: number;
  order: number;
}

export interface QuickFunnel {
  id: string;
  workspace_id: string;
  title: string;
  steps: FunnelStep[];
  created_at: string;
  updated_at: string;
}

export function useQuickFunnels() {
  const [funnels, setFunnels] = useState<QuickFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();

  const fetchFunnels = async () => {
    if (!selectedWorkspace?.workspace_id) {
      setFunnels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_funnels')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('title', { ascending: true });

      if (error) throw error;
      setFunnels((data || []) as unknown as QuickFunnel[]);
    } catch (error) {
      console.error('Error fetching quick funnels:', error);
      toast.error('Erro ao carregar funis rápidos');
      setFunnels([]);
    } finally {
      setLoading(false);
    }
  };

  const createFunnel = async (title: string, steps: FunnelStep[]) => {
    if (!selectedWorkspace?.workspace_id) {
      toast.error('Nenhum workspace selecionado');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quick_funnels')
        .insert({
          workspace_id: selectedWorkspace.workspace_id,
          title,
          steps: steps as any
        })
        .select()
        .single();

      if (error) throw error;

      setFunnels(prev => [...prev, data as unknown as QuickFunnel]);
      toast.success('Funil criado com sucesso');
      return data as unknown as QuickFunnel;
    } catch (error) {
      console.error('Error creating funnel:', error);
      toast.error('Erro ao criar funil');
    }
  };

  const updateFunnel = async (id: string, title: string, steps: FunnelStep[]) => {
    try {
      const { data, error } = await supabase
        .from('quick_funnels')
        .update({ title, steps: steps as any })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setFunnels(prev => prev.map(f => f.id === id ? data as unknown as QuickFunnel : f));
      toast.success('Funil atualizado com sucesso');
      return data as unknown as QuickFunnel;
    } catch (error) {
      console.error('Error updating funnel:', error);
      toast.error('Erro ao atualizar funil');
    }
  };

  const deleteFunnel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_funnels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFunnels(prev => prev.filter(f => f.id !== id));
      toast.success('Funil deletado com sucesso');
    } catch (error) {
      console.error('Error deleting funnel:', error);
      toast.error('Erro ao deletar funil');
    }
  };

  useEffect(() => {
    fetchFunnels();
  }, [selectedWorkspace, user]);

  return {
    funnels,
    loading,
    createFunnel,
    updateFunnel,
    deleteFunnel,
    refetch: fetchFunnels
  };
}
