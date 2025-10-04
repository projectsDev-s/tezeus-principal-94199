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
    if (!selectedWorkspace || !user) {
      // Missing workspace or user data
      return;
    }
    
    setIsLoading(true);
    try {
      const workspaceId = selectedWorkspace.workspace_id;
      const isUser = userRole === 'user';
      // Starting analytics fetch

      // Fetch conversations data
      let conversationQuery = supabase
        .from('conversations')
        .select('id, status, created_at')
        .eq('workspace_id', workspaceId);

      if (isUser) {
        conversationQuery = conversationQuery.eq('assigned_user_id', user.id);
      }

      // Fetching conversations
      const { data: conversations, error: conversationsError } = await conversationQuery;
      
      if (conversationsError) {
        console.error('❌ Analytics: Conversations error', conversationsError);
        throw conversationsError;
      }
      
      console.log('✅ Analytics: Conversations fetched', { count: conversations?.length || 0 });

      const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
      const totalConversations = conversations?.length || 0;

      // Fetch pipelines for this workspace first
      // Fetching pipelines
      const { data: pipelines, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId);

      if (pipelinesError) {
        console.error('❌ Analytics: Pipelines error', pipelinesError);
        throw pipelinesError;
      }

      const pipelineIds = pipelines?.map(p => p.id) || [];
      console.log('✅ Analytics: Pipelines fetched', { count: pipelines?.length || 0, pipelineIds });

      if (pipelineIds.length === 0) {
        console.log('⚠️ Analytics: No pipelines found, skipping cards fetch');
        // Continue with just conversation data
        const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
        const totalConversations = conversations?.length || 0;

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

      // Fetch pipeline columns
      // Fetching pipeline columns
      const { data: columns, error: columnsError } = await supabase
        .from('pipeline_columns')
        .select('id, name')
        .in('pipeline_id', pipelineIds);

      if (columnsError) {
        console.error('❌ Analytics: Columns error', columnsError);
        throw columnsError;
      }
      
      console.log('✅ Analytics: Columns fetched', { count: columns?.length || 0 });

      // Fetch pipeline cards
      // Fetching pipeline cards
      let cardsQuery = supabase
        .from('pipeline_cards')
        .select('id, column_id, value, created_at, updated_at')
        .in('column_id', columns?.map(c => c.id) || []);

      if (isUser) {
        cardsQuery = cardsQuery.eq('responsible_user_id', user.id);
        // Filtering cards by user
      }

      const { data: cards, error: cardsError } = await cardsQuery;
      
      if (cardsError) {
        console.error('❌ Analytics: Cards error', cardsError);
        throw cardsError;
      }
      
      console.log('✅ Analytics: Cards fetched', { count: cards?.length || 0 });

      // Create a map of column names
      const columnMap = new Map(columns?.map(col => [col.id, col.name.toLowerCase()]) || []);

      // Categorize deals
      let completedDealsCount = 0;
      let lostDealsCount = 0;
      let dealsInProgressCount = 0;

      cards?.forEach(card => {
        const columnName = columnMap.get(card.column_id) || '';
        
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
        const dayCards = cards?.filter(card => 
          card.updated_at?.startsWith(date)
        ) || [];

        const completed = dayCards.filter(card => {
          const columnName = columnMap.get(card.column_id) || '';
          return columnName.includes('concluído');
        }).length;

        const lost = dayCards.filter(card => {
          const columnName = columnMap.get(card.column_id) || '';
          return columnName.includes('perdido');
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
      
      console.log('📈 Analytics: Final results', finalAnalytics);
      setAnalytics(finalAnalytics);

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
    } finally {
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