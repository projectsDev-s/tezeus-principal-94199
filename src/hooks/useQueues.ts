import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface Queue {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order_position?: number;
  distribution_type?: string;
  ai_agent_id?: string;
  greeting_message?: string;
  workspace_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ai_agent?: {
    id: string;
    name: string;
  };
}

export function useQueues(workspaceIdProp?: string) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();

  // Priorizar workspaceId da prop, senão usar do contexto
  const workspaceId = workspaceIdProp || selectedWorkspace?.workspace_id;

  const fetchQueues = async () => {
    if (!workspaceId) {
      console.log('🚫 useQueues: Nenhum workspace disponível', { 
        prop: workspaceIdProp, 
        context: selectedWorkspace?.workspace_id 
      });
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 useQueues: Buscando filas para workspace:', workspaceId);
      
      const { data, error } = await supabase
        .from('queues')
        .select(`
          *,
          ai_agent:ai_agents(id, name)
        `)
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('order_position', { ascending: true });

      if (error) {
        console.error('❌ useQueues: Erro ao buscar filas:', error);
        throw error;
      }
      
      console.log('✅ useQueues: Filas carregadas:', data?.length || 0, 'filas');
      setQueues(data || []);
    } catch (error) {
      console.error('❌ useQueues: Erro ao carregar filas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [workspaceId]);

  return {
    queues,
    loading,
    refetch: fetchQueues
  };
}