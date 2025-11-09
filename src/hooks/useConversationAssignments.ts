import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AssignmentEntry {
  id: string;
  action: string;
  changed_at: string;
  changed_by: string | null;
  from_assigned_user_id: string | null;
  to_assigned_user_id: string | null;
  from_user_name?: string;
  to_user_name?: string;
  changed_by_name?: string;
}

export const useConversationAssignments = (conversationId?: string) => {
  return useQuery({
    queryKey: ['conversation-assignments', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('conversation_assignments')
        .select(`
          id,
          action,
          changed_at,
          changed_by,
          from_assigned_user_id,
          to_assigned_user_id
        `)
        .eq('conversation_id', conversationId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar histórico de atribuições:', error);
        throw error;
      }

      // Buscar nomes dos usuários
      const userIds = new Set<string>();
      data?.forEach(entry => {
        if (entry.from_assigned_user_id) userIds.add(entry.from_assigned_user_id);
        if (entry.to_assigned_user_id) userIds.add(entry.to_assigned_user_id);
        if (entry.changed_by) userIds.add(entry.changed_by);
      });

      const { data: users } = await supabase
        .from('system_users')
        .select('id, name')
        .in('id', Array.from(userIds));

      const userMap = new Map(users?.map(u => [u.id, u.name]) || []);

      return (data || []).map(entry => ({
        ...entry,
        from_user_name: entry.from_assigned_user_id ? userMap.get(entry.from_assigned_user_id) : null,
        to_user_name: entry.to_assigned_user_id ? userMap.get(entry.to_assigned_user_id) : null,
        changed_by_name: entry.changed_by ? userMap.get(entry.changed_by) : null,
      })) as AssignmentEntry[];
    },
    enabled: !!conversationId,
  });
};
