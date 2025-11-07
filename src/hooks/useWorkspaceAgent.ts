import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useWorkspaceAgent = (conversationId?: string) => {
  console.log('🤖 useWorkspaceAgent - conversationId:', conversationId);
  
  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['conversation-agent', conversationId],
    queryFn: async () => {
      if (!conversationId) {
        console.log('❌ Conversation ID não disponível');
        return null;
      }
      
      console.log('🔍 Buscando agente ativo para conversa:', conversationId);
      
      // Primeiro busca a conversa para pegar o agent_active_id
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('agent_active_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      if (convError) {
        console.error('❌ Erro ao buscar conversa:', convError);
        throw convError;
      }
      
      if (!conversation?.agent_active_id) {
        console.log('ℹ️ Nenhum agente ativo para esta conversa');
        return null;
      }
      
      console.log('🔍 Buscando dados do agente:', conversation.agent_active_id);
      
      // Agora busca os dados do agente
      const { data: agentData, error: agentError } = await supabase
        .from('ai_agents')
        .select('id, name, is_active, agent_type')
        .eq('id', conversation.agent_active_id)
        .maybeSingle();
      
      if (agentError) {
        console.error('❌ Erro ao buscar agente:', agentError);
        throw agentError;
      }
      
      console.log('📊 Agente encontrado:', agentData);
      return agentData;
    },
    enabled: !!conversationId,
  });
  
  const hasAgent = !!agent;
  
  console.log('✅ Hook result:', { 
    hasAgent, 
    isLoading,
    agent: agent?.name 
  });
  
  return { 
    agent, 
    hasAgent, 
    isLoading 
  };
};
