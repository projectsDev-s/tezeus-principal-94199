import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { toast } from 'sonner';

export interface QueueUser {
  id: string;
  queue_id: string;
  user_id: string;
  order_position: number;
  created_at: string;
  system_users?: {
    id: string;
    name: string;
    email: string;
    profile: string;
    avatar?: string;
  };
}

export function useQueueUsers(queueId?: string) {
  const [users, setUsers] = useState<QueueUser[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueueUsers = useCallback(async () => {
    if (!queueId) return;

    try {
      setLoading(true);

      // Usar edge function com service_role para contornar RLS
      const { data, error } = await supabase.functions.invoke('get-queue-users', {
        body: { queueId }
      });

      if (error) {
        console.error('Erro ao invocar função:', error);
        throw error;
      }

      console.log('✅ Usuários da fila carregados:', data?.length || 0);
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários da fila:', error);
      toast.error('Erro ao carregar usuários da fila');
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  const addUsersToQueue = useCallback(async (userIds: string[]) => {
    if (!queueId) return;

    try {
      // Get max position
      const { data: existingUsers } = await supabase
        .from('queue_users')
        .select('order_position')
        .eq('queue_id', queueId)
        .order('order_position', { ascending: false })
        .limit(1);

      const maxPosition = existingUsers?.[0]?.order_position ?? -1;

      // Create queue user records
      const queueUsers = userIds.map((userId, index) => ({
        queue_id: queueId,
        user_id: userId,
        order_position: maxPosition + index + 1,
      }));

      const { error } = await supabase
        .from('queue_users')
        .insert(queueUsers);

      if (error) throw error;

      toast.success(`${userIds.length} usuário(s) adicionado(s) à fila`);
      await loadQueueUsers();
    } catch (error: any) {
      console.error('Erro ao adicionar usuários à fila:', error);
      if (error.code === '23505') {
        toast.error('Um ou mais usuários já estão na fila');
      } else {
        toast.error('Erro ao adicionar usuários à fila');
      }
    }
  }, [queueId, loadQueueUsers]);

  const removeUserFromQueue = useCallback(async (userId: string) => {
    if (!queueId) return;

    try {
      const { error } = await supabase
        .from('queue_users')
        .delete()
        .eq('queue_id', queueId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Usuário removido da fila');
      await loadQueueUsers();
    } catch (error) {
      console.error('Erro ao remover usuário da fila:', error);
      toast.error('Erro ao remover usuário da fila');
    }
  }, [queueId, loadQueueUsers]);

  const updateUserOrder = useCallback(async (userId: string, newPosition: number) => {
    if (!queueId) return;

    try {
      const { error } = await supabase
        .from('queue_users')
        .update({ order_position: newPosition })
        .eq('queue_id', queueId)
        .eq('user_id', userId);

      if (error) throw error;
      await loadQueueUsers();
    } catch (error) {
      console.error('Erro ao atualizar ordem do usuário:', error);
      toast.error('Erro ao atualizar ordem do usuário');
    }
  }, [queueId, loadQueueUsers]);

  // Set user context when the hook initializes
  useEffect(() => {
    const setContext = async () => {
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (currentUserData?.id) {
        await supabase.rpc('set_current_user_context', {
          user_id: currentUserData.id,
          user_email: currentUserData.email || ''
        });
      }
    };
    
    setContext();
  }, []);

  return {
    users,
    loading,
    loadQueueUsers,
    addUsersToQueue,
    removeUserFromQueue,
    updateUserOrder,
  };
}
