import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
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
  const { getHeaders } = useWorkspaceHeaders();

  const loadQueueUsers = useCallback(async () => {
    if (!queueId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('manage-queue-users', {
        body: { action: 'list', queueId },
        headers: getHeaders(),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao carregar usuários');
      
      setUsers(data.users || []);
    } catch (error) {
      console.error('Erro ao carregar usuários da fila:', error);
      toast.error('Erro ao carregar usuários da fila');
    } finally {
      setLoading(false);
    }
  }, [queueId, getHeaders]);

  const addUsersToQueue = useCallback(async (userIds: string[]) => {
    if (!queueId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-queue-users', {
        body: { action: 'add', queueId, userIds },
        headers: getHeaders(),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao adicionar usuários');

      toast.success(data.message);
      await loadQueueUsers();
    } catch (error: any) {
      console.error('Erro ao adicionar usuários à fila:', error);
      if (error.message?.includes('23505')) {
        toast.error('Um ou mais usuários já estão na fila');
      } else {
        toast.error('Erro ao adicionar usuários à fila');
      }
    }
  }, [queueId, getHeaders, loadQueueUsers]);

  const removeUserFromQueue = useCallback(async (userId: string) => {
    if (!queueId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-queue-users', {
        body: { action: 'remove', queueId, userId },
        headers: getHeaders(),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao remover usuário');

      toast.success(data.message);
      await loadQueueUsers();
    } catch (error) {
      console.error('Erro ao remover usuário da fila:', error);
      toast.error('Erro ao remover usuário da fila');
    }
  }, [queueId, getHeaders, loadQueueUsers]);

  const updateUserOrder = useCallback(async (userId: string, newPosition: number) => {
    if (!queueId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-queue-users', {
        body: { action: 'updateOrder', queueId, userId, newPosition },
        headers: getHeaders(),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao atualizar ordem');
      
      await loadQueueUsers();
    } catch (error) {
      console.error('Erro ao atualizar ordem do usuário:', error);
      toast.error('Erro ao atualizar ordem do usuário');
    }
  }, [queueId, getHeaders, loadQueueUsers]);

  return {
    users,
    loading,
    loadQueueUsers,
    addUsersToQueue,
    removeUserFromQueue,
    updateUserOrder,
  };
}
