import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssignmentEntry {
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

      const { data, error } = await supabase.functions.invoke('conversation-assignments-history', {
        body: { conversation_id: conversationId }
      });

      if (error) {
        console.error('❌ Erro ao buscar histórico de atribuições:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao carregar histórico de atribuições');
      }

      return (data.items || []).map((entry: any) => ({
        ...entry,
        from_user_name: entry.from_user_name ?? null,
        to_user_name: entry.to_user_name ?? null,
        changed_by_name: entry.changed_by_name ?? null,
      })) as AssignmentEntry[];
    },
    enabled: !!conversationId,
  });
};
