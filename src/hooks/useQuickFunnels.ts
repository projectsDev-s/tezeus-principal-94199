import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface FunnelStep {
  id: string;
  type: 'message' | 'audio' | 'media' | 'document';
  item_id: string;
  delay_seconds: number;
  order: number;
}

export interface Funnel {
  id: string;
  title: string;
  workspace_id: string;
  steps: FunnelStep[];
  created_at: string;
}

export function useQuickFunnels() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedWorkspace } = useWorkspace();

  useEffect(() => {
    if (selectedWorkspace?.workspace_id && user) {
      fetchFunnels();
    }
  }, [selectedWorkspace?.workspace_id, user]);

  const fetchFunnels = async () => {
    if (!selectedWorkspace?.workspace_id || !user) {
      setFunnels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('quick_funnels')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFunnels((data || []) as Funnel[]);
    } catch (error) {
      console.error('Error fetching funnels:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar funis',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createFunnel = async (title: string, steps: FunnelStep[]) => {
    if (!selectedWorkspace?.workspace_id || !user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('quick_funnels')
        .insert({
          title,
          steps,
          workspace_id: selectedWorkspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;

      setFunnels(prev => [data as Funnel, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Funil criado com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating funnel:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar funil',
        variant: 'destructive',
      });
    }
  };

  const updateFunnel = async (id: string, title: string, steps: FunnelStep[]) => {
    try {
      const { data, error } = await (supabase as any)
        .from('quick_funnels')
        .update({ title, steps })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setFunnels(prev => prev.map(funnel => funnel.id === id ? (data as Funnel) : funnel));
      toast({
        title: 'Sucesso',
        description: 'Funil atualizado com sucesso',
      });
    } catch (error) {
      console.error('Error updating funnel:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar funil',
        variant: 'destructive',
      });
    }
  };

  const deleteFunnel = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('quick_funnels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFunnels(prev => prev.filter(funnel => funnel.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Funil excluído com sucesso',
      });
    } catch (error) {
      console.error('Error deleting funnel:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir funil',
        variant: 'destructive',
      });
    }
  };

  return {
    funnels,
    loading,
    createFunnel,
    updateFunnel,
    deleteFunnel,
    refetch: fetchFunnels,
  };
}
