import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';
import { PipelineCard } from './usePipelines';

export function usePipelineCards(pipelineId: string | null) {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const fetchCards = async () => {
    if (!pipelineId) {
      setCards([]);
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();
      
      console.log('🔍 usePipelineCards: Buscando cards para pipeline:', pipelineId);
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers
      });

      if (error) throw error;
      
      console.log('📦 usePipelineCards: Cards carregados:', data?.length || 0);
      console.log('🔎 usePipelineCards: Primeiro card exemplo:', data?.[0]);
      
      setCards(data || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cards",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCard = async (cardData: {
    column_id: string;
    conversation_id?: string;
    contact_id?: string;
    title: string;
    description?: string;
    value?: number;
    status?: string;
    tags?: any[];
    responsible_user_id?: string;
  }) => {
    if (!pipelineId) return;

    try {
      const headers = getHeaders();
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers,
        body: { 
          pipeline_id: pipelineId,
          ...cardData 
        }
      });

      if (error) throw error;

      setCards(prev => [data, ...prev]);
      
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar card",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateCard = async (cardId: string, updates: Partial<PipelineCard>) => {
    try {
      const headers = getHeaders();
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers,
        body: updates 
      });

      if (error) throw error;

      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      ));

      return data;
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar card",
        variant: "destructive",
      });
      throw error;
    }
  };

  const moveCard = async (cardId: string, newColumnId: string) => {
    return updateCard(cardId, { column_id: newColumnId });
  };

  const getCardsByColumn = (columnId: string) => {
    return cards.filter(card => card.column_id === columnId);
  };

  useEffect(() => {
    fetchCards();
  }, [pipelineId]);

  return {
    cards,
    isLoading,
    fetchCards,
    createCard,
    updateCard,
    moveCard,
    getCardsByColumn,
  };
}