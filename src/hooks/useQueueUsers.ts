import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase
        .from('queue_users')
        .select(`
          *,
          system_users (
            id,
            name,
            email,
            profile,
            avatar
          )
        `)
        .eq('queue_id', queueId)
        .order('order_position', { ascending: true });

      if (error) throw error;
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
      // Buscar a maior posição atual
      const { data: existingUsers } = await supabase
        .from('queue_users')
        .select('order_position')
        .eq('queue_id', queueId)
        .order('order_position', { ascending: false })
        .limit(1);

      const maxPosition = existingUsers?.[0]?.order_position ?? -1;

      // Criar registros para cada usuário
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

  return {
    users,
    loading,
    loadQueueUsers,
    addUsersToQueue,
    removeUserFromQueue,
    updateUserOrder,
  };
}
