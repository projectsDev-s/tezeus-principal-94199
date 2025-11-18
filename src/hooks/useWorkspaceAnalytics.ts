import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useRetry } from './useRetry';

export interface WorkspaceAnalytics {
  activeConversations: number;
  totalConversations: number;
  dealsInProgress: number;
  completedDeals: number;
  lostDeals: number;
  conversionRate: number;
  averageResponseTime: number;
  conversationTrends: { date: string; count: number }[];
  dealTrends: { date: string; completed: number; lost: number }[];
}

export const useWorkspaceAnalytics = () => {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics>({
    activeConversations: 0,
    totalConversations: 0,
    dealsInProgress: 0,
    completedDeals: 0,
    lostDeals: 0,
    conversionRate: 0,
    averageResponseTime: 0,
    conversationTrends: [],
    dealTrends: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();
  const { getHeaders } = useWorkspaceHeaders();
  const { retry } = useRetry();
  const hasFetched = useRef(false);

  const fetchAnalytics = async () => {
    setIsLoading(true); // Skeleton imediato
    
    if (!selectedWorkspace || !user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const workspaceId = selectedWorkspace.workspace_id;
      const isUser = userRole === 'user';
      
      // Get headers - if fail, return early
      let headers;
      try {
        headers = getHeaders();
      } catch (error) {
        console.error('❌ Analytics: Failed to get headers', error);
        setIsLoading(false);
        return;
      }

      // ETAPA 2: Buscar conversas e pipelines
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, status, created_at, assigned_user_id')
        .eq('workspace_id', workspaceId);
      
      if (conversationsError) {
        console.error('❌ Analytics: Conversations error', conversationsError);
        throw conversationsError;
      }

      const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
      const totalConversations = conversations?.length || 0;

      console.log('✅ Analytics: Conversations loaded', { 
        activeConversations, 
        totalConversations,
        userRole: isUser ? 'user' : 'admin',
        userId: user.id
      });

      // Buscar pipelines via edge function (RLS-safe) usando GET
      const { data: pipelinesResponse, error: pipelinesError } = await supabase.functions.invoke(
        'pipeline-management/pipelines',
        {
          method: 'GET',
          headers
        }
      );

      if (pipelinesError) {
        console.error('❌ Analytics: Pipelines error', pipelinesError);
        throw pipelinesError;
      }

      const pipelines = pipelinesResponse || [];
      const pipelineIds = pipelines.map((p: any) => p.id);
      
      console.log('✅ Analytics: Pipelines loaded', { count: pipelines.length, pipelineIds });

      if (pipelineIds.length === 0) {
        setAnalytics({
          activeConversations,
          totalConversations,
          dealsInProgress: 0,
          completedDeals: 0,
          lostDeals: 0,
          conversionRate: 0,
          averageResponseTime: 0,
          conversationTrends: [],
          dealTrends: [],
        });
        return;
      }

      // ETAPA 3: Buscar cards e colunas em paralelo (otimizado)
      const [cardsResults, columnsResults] = await Promise.all([
        // Buscar cards de todos os pipelines em paralelo
        Promise.all(pipelineIds.map(pipelineId => 
          supabase.functions.invoke(
            `pipeline-management/cards?pipeline_id=${pipelineId}`,
            { method: 'GET', headers }
          ).then(({ data, error }) => {
            if (error) {
              console.error(`❌ Cards error for pipeline ${pipelineId}`, error);
              return [];
            }
            return Array.isArray(data) ? data : [];
          })
        )),
        // Buscar colunas de todos os pipelines em paralelo
        Promise.all(pipelineIds.map(pipelineId =>
          supabase.functions.invoke(
            `pipeline-management/columns?pipeline_id=${pipelineId}`,
            { method: 'GET', headers }
          ).then(({ data, error }) => {
            if (error) {
              console.error(`❌ Columns error for pipeline ${pipelineId}`, error);
              return [];
            }
            return Array.isArray(data) ? data : [];
          })
        ))
      ]);

      // Combinar todos os cards e colunas
      const allCards = cardsResults.flat();
      const columnsMap = new Map();
      columnsResults.flat().forEach((col: any) => columnsMap.set(col.id, col));

      console.log('✅ Analytics: Data loaded in parallel', { 
        totalCards: allCards.length,
        totalColumns: columnsMap.size 
      });

      // Processar cards
      let completedDealsCount = 0;
      let lostDealsCount = 0;
      let dealsInProgressCount = 0;

      allCards.forEach(card => {
        const column = columnsMap.get(card.column_id);
        const columnName = column?.name?.toLowerCase() || '';
        
        if (columnName.includes('concluído') || columnName.includes('ganho') || columnName.includes('fechado') || columnName.includes('comprou')) {
          completedDealsCount++;
        } else if (columnName.includes('perdido') || columnName.includes('cancelado') || columnName.includes('recusado')) {
          lostDealsCount++;
        } else {
          dealsInProgressCount++;
        }
      });

      // Calculate conversion rate
      const totalClosedDeals = completedDealsCount + lostDealsCount;
      const conversionRate = totalClosedDeals > 0 ? (completedDealsCount / totalClosedDeals) * 100 : 0;

      // Get trends data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      // Conversation trends
      const conversationTrends = last7Days.map(date => {
        const count = conversations?.filter(conv => 
          conv.created_at?.startsWith(date)
        ).length || 0;
        
        return { date, count };
      });

      // Deal trends
      const dealTrends = last7Days.map(date => {
        const dayCards = allCards.filter(card => 
          card.updated_at?.startsWith(date)
        );

        const completed = dayCards.filter(card => {
          const column = columnsMap.get(card.column_id);
          const columnName = column?.name?.toLowerCase() || '';
          return columnName.includes('concluído') || columnName.includes('ganho') || columnName.includes('comprou');
        }).length;

        const lost = dayCards.filter(card => {
          const column = columnsMap.get(card.column_id);
          const columnName = column?.name?.toLowerCase() || '';
          return columnName.includes('perdido') || columnName.includes('cancelado');
        }).length;

        return { date, completed, lost };
      });

      const finalAnalytics = {
        activeConversations,
        totalConversations,
        dealsInProgress: dealsInProgressCount,
        completedDeals: completedDealsCount,
        lostDeals: lostDealsCount,
        conversionRate,
        averageResponseTime: 0, // TODO: Calculate from message data
        conversationTrends,
        dealTrends,
      };
      
      console.log('✅ Analytics: Data fetched successfully', finalAnalytics);
      
      // Update state BEFORE marking as not loading
      setAnalytics(finalAnalytics);
      setIsLoading(false);

    } catch (error) {
      console.error('❌ Analytics: Error fetching workspace analytics:', error);
      console.error('❌ Analytics: Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Set default values on error
      const defaultAnalytics = {
        activeConversations: 0,
        totalConversations: 0,
        dealsInProgress: 0,
        completedDeals: 0,
        lostDeals: 0,
        conversionRate: 0,
        averageResponseTime: 0,
        conversationTrends: [],
        dealTrends: [],
      };
      
      console.log('📊 Analytics: Using default values due to error', defaultAnalytics);
      setAnalytics(defaultAnalytics);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    if (!selectedWorkspace) return;
    hasFetched.current = true;
    fetchAnalytics();
  }, [selectedWorkspace, user, userRole]);

  return {
    analytics,
    isLoading,
    refetch: fetchAnalytics,
  };
};