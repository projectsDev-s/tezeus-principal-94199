import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';

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
  const [isLoading, setIsLoading] = useState(false);
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();

  const fetchAnalytics = async () => {
    setIsLoading(true); // Skeleton imediato
    
    if (!selectedWorkspace || !user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const workspaceId = selectedWorkspace.workspace_id;
      const isUser = userRole === 'user';

      // ETAPA 2: Queries paralelas - Primeira rodada (conversations + pipelines)
      let conversationQuery = supabase
        .from('conversations')
        .select('id, status, created_at')
        .eq('workspace_id', workspaceId);

      if (isUser) {
        conversationQuery = conversationQuery.eq('assigned_user_id', user.id);
      }

      const [
        { data: conversations, error: conversationsError },
        { data: pipelines, error: pipelinesError }
      ] = await Promise.all([
        conversationQuery,
        supabase
          .from('pipelines')
          .select('id')
          .eq('workspace_id', workspaceId)
      ]);
      
      if (conversationsError) {
        console.error('❌ Analytics: Conversations error', conversationsError);
        throw conversationsError;
      }

      if (pipelinesError) {
        console.error('❌ Analytics: Pipelines error', pipelinesError);
        throw pipelinesError;
      }

      const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
      const totalConversations = conversations?.length || 0;

      const pipelineIds = pipelines?.map(p => p.id) || [];

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

      // ETAPA 3: Query otimizada com JOIN (cards + columns em uma query)
      let cardsQuery = supabase
        .from('pipeline_cards')
        .select(`
          id,
          column_id,
          value,
          created_at,
          updated_at,
          pipeline_columns!inner(
            id,
            name,
            pipeline_id
          )
        `)
        .in('pipeline_columns.pipeline_id', pipelineIds);

      if (isUser) {
        cardsQuery = cardsQuery.eq('responsible_user_id', user.id);
      }

      const { data: cardsWithColumns, error: cardsError } = await cardsQuery;
      
      if (cardsError) {
        console.error('❌ Analytics: Cards error', cardsError);
        throw cardsError;
      }

      // Processar cards com dados da coluna já embutidos
      let completedDealsCount = 0;
      let lostDealsCount = 0;
      let dealsInProgressCount = 0;

      cardsWithColumns?.forEach(card => {
        const columnName = (card.pipeline_columns as any)?.name?.toLowerCase() || '';
        
        if (columnName.includes('concluído') || columnName.includes('ganho') || columnName.includes('fechado')) {
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
        const dayCards = cardsWithColumns?.filter(card => 
          card.updated_at?.startsWith(date)
        ) || [];

        const completed = dayCards.filter(card => {
          const columnName = (card.pipeline_columns as any)?.name?.toLowerCase() || '';
          return columnName.includes('concluído') || columnName.includes('ganho');
        }).length;

        const lost = dayCards.filter(card => {
          const columnName = (card.pipeline_columns as any)?.name?.toLowerCase() || '';
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
    fetchAnalytics();
  }, [selectedWorkspace, user, userRole]);

  return {
    analytics,
    isLoading,
    refetch: fetchAnalytics,
  };
};