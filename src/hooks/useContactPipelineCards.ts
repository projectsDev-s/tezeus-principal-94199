import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export interface ContactPipelineCard {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  column_id: string;
  status: string;
  value?: number;
  title: string;
  description?: string;
}

export function useContactPipelineCards(contactId: string | null) {
  const [cards, setCards] = useState<ContactPipelineCard[]>([]);
  const [currentPipeline, setCurrentPipeline] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const fetchContactCards = async () => {
    if (!contactId) {
      setCards([]);
      setCurrentPipeline(null);
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();
      
      // Buscar todos os cards do contato
      const { data: cardsData, error: cardsError } = await supabase
        .from('pipeline_cards')
        .select(`
          id,
          pipeline_id,
          column_id,
          status,
          value,
          title,
          description,
          pipelines!inner(id, name)
        `)
        .eq('contact_id', contactId);

      if (cardsError) throw cardsError;

      const formattedCards = cardsData?.map(card => ({
        id: card.id,
        pipeline_id: card.pipeline_id,
        pipeline_name: (card.pipelines as any)?.name || '',
        column_id: card.column_id,
        status: card.status,
        value: card.value,
        title: card.title,
        description: card.description,
      })) || [];

      setCards(formattedCards);
      
      // Definir pipeline atual (primeiro card ativo encontrado)
      if (formattedCards.length > 0) {
        const firstCard = formattedCards[0];
        setCurrentPipeline({
          id: firstCard.pipeline_id,
          name: firstCard.pipeline_name
        });
      } else {
        setCurrentPipeline(null);
      }

    } catch (error) {
      console.error('Error fetching contact cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cards do contato",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const transferToPipeline = async (pipelineId: string, pipelineName: string) => {
    if (!contactId) return;

    try {
      const headers = getHeaders();
      
      // Verificar se já existe card nesse pipeline
      const existingCard = cards.find(card => card.pipeline_id === pipelineId);
      
      if (existingCard) {
        // Se já existe, apenas notificar
        toast({
          title: "Informação",
          description: `Contato já possui negócio no pipeline "${pipelineName}"`,
        });
        return;
      }

      // Buscar primeira coluna do pipeline
      const { data: columns, error: columnsError } = await supabase
        .from('pipeline_columns')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('order_position')
        .limit(1);

      if (columnsError) throw columnsError;
      
      if (!columns || columns.length === 0) {
        toast({
          title: "Erro",
          description: "Pipeline não possui colunas configuradas",
          variant: "destructive",
        });
        return;
      }

      // Criar novo card no pipeline
      const { data, error } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers,
        body: { 
          pipeline_id: pipelineId,
          column_id: columns[0].id,
          contact_id: contactId,
          title: `Negócio - Contato`,
          description: 'Negócio criado automaticamente',
          status: 'aberto'
        }
      });

      if (error) throw error;

      // Atualizar estado local
      await fetchContactCards();
      
      toast({
        title: "Sucesso",
        description: `Contato transferido para o pipeline "${pipelineName}"`,
      });

    } catch (error) {
      console.error('Error transferring to pipeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir contato para pipeline",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchContactCards();
  }, [contactId]);

  return {
    cards,
    currentPipeline,
    isLoading,
    fetchContactCards,
    transferToPipeline,
  };
}