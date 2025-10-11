import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePipelineRealtime } from '@/hooks/usePipelineRealtime';

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineColumn {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  order_position: number;
  created_at: string;
  permissions?: string[]; // Array de user_ids que podem ver esta coluna
}

export interface PipelineCard {
  id: string;
  pipeline_id: string;
  column_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  value: number;
  status: string;
  tags: any[];
  created_at: string;
  updated_at: string;
  responsible_user_id?: string;
  responsible_user?: {
    id: string;
    name: string;
  };
  contact?: any;
  conversation?: any;
}

interface PipelinesContextType {
  pipelines: Pipeline[];
  selectedPipeline: Pipeline | null;
  columns: PipelineColumn[];
  cards: PipelineCard[];
  isLoading: boolean;
  isLoadingColumns: boolean;
  fetchPipelines: () => Promise<void>;
  createPipeline: (name: string, type: string) => Promise<Pipeline>;
  deletePipeline: (pipelineId: string) => Promise<void>;
  selectPipeline: (pipeline: Pipeline) => void;
  refreshCurrentPipeline: () => Promise<void>;
  createColumn: (name: string, color: string) => Promise<PipelineColumn>;
  createCard: (cardData: Partial<PipelineCard>) => Promise<PipelineCard>;
  updateCard: (cardId: string, updates: Partial<PipelineCard>) => Promise<void>;
  moveCard: (cardId: string, newColumnId: string) => Promise<void>;
  moveCardOptimistic: (cardId: string, newColumnId: string) => Promise<void>;
  getCardsByColumn: (columnId: string) => PipelineCard[];
  reorderColumns: (newColumns: PipelineColumn[]) => Promise<void>;
}

const PipelinesContext = createContext<PipelinesContextType | undefined>(undefined);

export function PipelinesProvider({ children }: { children: React.ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  // Estabilizar a função getHeaders para evitar re-renders desnecessários
  const getHeaders = useMemo(() => {
    if (!selectedWorkspace?.workspace_id) {
      return null;
    }
    
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (!currentUserData?.id) {
      return null;
    }

    const headers = {
      'x-system-user-id': currentUserData.id,
      'x-system-user-email': currentUserData.email || '',
      'x-workspace-id': selectedWorkspace.workspace_id
    };
    
    return headers;
  }, [selectedWorkspace?.workspace_id]);

  const fetchPipelines = useCallback(async (forceSelectFirst = false) => {
    if (!getHeaders) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers: getHeaders
      });

      if (error) {
        console.error('❌ Pipeline fetch error:', error);
        throw error;
      }

      setPipelines(data || []);
      
      // Auto-select first pipeline if forced or if none selected and we have pipelines
      if (data?.length > 0 && (forceSelectFirst || !selectedPipeline)) {
        // Auto-selecting first pipeline
        setSelectedPipeline(data[0]);
      }
    } catch (error) {
      console.error('❌ Error fetching pipelines:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines. Verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, toast]);

  const fetchColumns = useCallback(async (pipelineId: string) => {
    if (!getHeaders || !pipelineId) return;

    try {
      setIsLoadingColumns(true);
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: getHeaders
      });

      if (error) throw error;
      setColumns(data || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas",
        variant: "destructive",
      });
    } finally {
      setIsLoadingColumns(false);
    }
  }, [getHeaders, toast]);

  const fetchCards = useCallback(async (pipelineId: string) => {
    if (!getHeaders || !pipelineId) return;

    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: getHeaders
      });

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cards",
        variant: "destructive",
      });
    }
  }, [getHeaders, toast]);

  const createPipeline = useCallback(async (name: string, type: string) => {
    if (!getHeaders) throw new Error('Headers not available');
    
    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'POST',
        headers: getHeaders,
        body: { name, type }
      });

      if (error) throw error;

      setPipelines(prev => [data, ...prev]);
      setSelectedPipeline(data);
      
      toast({
        title: "Sucesso",
        description: "Pipeline criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar pipeline",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, toast]);

  const deletePipeline = useCallback(async (pipelineId: string) => {
    if (!getHeaders) throw new Error('Headers não disponíveis');

    const { data, error } = await supabase.functions.invoke(
      `pipeline-management/pipelines?id=${pipelineId}`,
      {
        method: 'DELETE',
        headers: getHeaders
      }
    );

    if (error) {
      console.error('❌ Erro ao deletar pipeline:', error);
      throw error;
    }

    console.log('✅ Pipeline deletado com sucesso');
    
    // Atualizar lista de pipelines
    await fetchPipelines();
    
    // Se era o pipeline selecionado, limpar seleção
    if (selectedPipeline?.id === pipelineId) {
      setSelectedPipeline(null);
      setColumns([]);
      setCards([]);
    }

    toast({
      title: "Pipeline excluído",
      description: "O pipeline foi excluído com sucesso.",
    });
  }, [getHeaders, toast, fetchPipelines, selectedPipeline]);

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    // Clear columns immediately when switching pipelines to trigger skeleton
    setColumns([]);
    setCards([]);
  }, []);

  // New function to refresh the current pipeline data
  const refreshCurrentPipeline = useCallback(async () => {
    if (selectedPipeline?.id) {
      await Promise.all([
        fetchColumns(selectedPipeline.id),
        fetchCards(selectedPipeline.id)
      ]);
    }
  }, [selectedPipeline?.id, fetchColumns, fetchCards]);

  const createColumn = useCallback(async (name: string, color: string) => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'POST',
        headers: getHeaders,
        body: { 
          pipeline_id: selectedPipeline.id,
          name,
          color 
        }
      });

      if (error) throw error;

      setColumns(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Coluna criada com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar coluna",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, selectedPipeline, toast]);

  const createCard = useCallback(async (cardData: Partial<PipelineCard>) => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    // Criar card otimista imediatamente no front-end
    const tempCardId = crypto.randomUUID();
    const optimisticCard: PipelineCard = {
      id: tempCardId,
      pipeline_id: selectedPipeline.id,
      column_id: cardData.column_id!,
      conversation_id: cardData.conversation_id || null,
      contact_id: cardData.contact_id || null,
      title: cardData.title || 'Novo card',
      description: cardData.description || null,
      value: cardData.value || 0,
      status: 'aberto',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      responsible_user_id: cardData.responsible_user_id,
      // Incluir dados do contato se fornecidos
      contact: (cardData as any).contact || null
    };

    // Adicionar card otimista imediatamente
    setCards(prev => [optimisticCard, ...prev]);

    try {
      console.log('🎯 Criando card no backend:', {
        pipeline_id: selectedPipeline.id,
        cardData
      });

      // Remover dados extras que não devem ir para o backend
      const { contact, ...backendCardData } = cardData as any;

      const { data, error } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers: getHeaders,
        body: {
          pipeline_id: selectedPipeline.id,
          ...backendCardData
        }
      });

      if (error) {
        console.error('❌ Erro ao criar card no backend:', error);
        // Remover card otimista em caso de erro
        setCards(prev => prev.filter(c => c.id !== tempCardId));
        throw error;
      }

      // Substituir card temporário pelo real retornado do backend
      setCards(prev => prev.map(c => c.id === tempCardId ? data : c));
      
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('❌ Error creating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar card",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, selectedPipeline, toast]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<PipelineCard>) => {
    if (!getHeaders) throw new Error('Headers not available');

    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers: getHeaders,
        body: updates
      });

      if (error) throw error;

      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, ...data } : card
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
  }, [getHeaders, toast]);

  const moveCard = useCallback(async (cardId: string, newColumnId: string) => {
    await updateCard(cardId, { column_id: newColumnId });
  }, [updateCard]);

  const moveCardOptimistic = useCallback(async (cardId: string, newColumnId: string) => {
    // 1. GUARDAR estado anterior para rollback
    const previousCards = [...cards];
    const cardToMove = cards.find(c => c.id === cardId);
    
    if (!cardToMove) return;

    console.log('🚀 [Optimistic] Movendo card instantaneamente:', {
      cardId,
      fromColumn: cardToMove.column_id,
      toColumn: newColumnId,
      timestamp: new Date().toISOString()
    });

    // 2. ATUALIZAR UI IMEDIATAMENTE (otimista)
    setCards(prev => prev.map(card => 
      card.id === cardId 
        ? { ...card, column_id: newColumnId, updated_at: new Date().toISOString() }
        : card
    ));

    // 3. SINCRONIZAR com backend em background (silencioso)
    try {
      if (!getHeaders) throw new Error('Headers not available');

      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers: getHeaders,
        body: { column_id: newColumnId }
      });

      if (error) throw error;

      console.log('✅ [Optimistic] Sincronização concluída:', {
        cardId,
        newColumn: newColumnId
      });

      // NÃO atualizar estado aqui - deixar o realtime fazer isso
      // Isso evita conflitos e garante que todos veem a mesma versão

    } catch (error) {
      console.error('❌ [Optimistic] Erro na sincronização - revertendo:', error);
      
      // 4. ROLLBACK: Reverter para estado anterior
      setCards(previousCards);
      
      // 5. MOSTRAR toast de erro
      toast({
        title: "Erro ao mover card",
        description: "O card foi retornado à posição original",
        variant: "destructive",
      });
    }
  }, [cards, getHeaders, toast]);

  const getCardsByColumn = useCallback((columnId: string) => {
    if (!selectedPipeline) return [];
    
    // Primeiro filtra por coluna e permissões
    const filteredCards = cards.filter(card => {
      // Filtro básico por coluna
      if (card.column_id !== columnId) return false;
      
      // Buscar informações do usuário atual
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      const currentUserId = currentUserData?.id;
      
      // Se é um usuário comum (não master/admin), aplicar filtros de responsabilidade
      if (userRole === 'user') {
        // Usuários só podem ver:
        // 1. Cards não atribuídos (responsible_user_id é null/undefined)
        // 2. Cards atribuídos a eles mesmos
        const isUnassigned = !card.responsible_user_id;
        const isAssignedToCurrentUser = card.responsible_user_id === currentUserId;
        
        if (!isUnassigned && !isAssignedToCurrentUser) {
          return false;
        }
      }
      
      return true;
    });

    // Deduplica apenas por ID (previne duplicatas reais de sincronização)
    const deduplicatedCards = filteredCards.reduce((acc, card) => {
      // Verifica se já existe um card com o MESMO ID na lista
      const existingCardIndex = acc.findIndex(c => c.id === card.id);
      
      if (existingCardIndex === -1) {
        // Não existe, adiciona
        acc.push(card);
      } else {
        // Existe (duplicata real), mantém o mais recente
        const existingCard = acc[existingCardIndex];
        const currentCardDate = new Date(card.updated_at);
        const existingCardDate = new Date(existingCard.updated_at);
        
        if (currentCardDate > existingCardDate) {
          // Card atual é mais recente, substitui
          acc[existingCardIndex] = card;
          console.log(`🔄 Duplicata real filtrada: mantendo versão mais recente do card ${card.id}`);
        }
      }
      
      return acc;
    }, [] as PipelineCard[]);

    // Log se houve deduplicação REAL (por ID)
    const removedCount = filteredCards.length - deduplicatedCards.length;
    if (removedCount > 0) {
      console.log(`⚠️ Atenção: ${removedCount} duplicata(s) real(is) removida(s) (mesmo ID)`);
    }

    return deduplicatedCards;
  }, [cards, userRole, selectedPipeline]);

  // Handlers para eventos realtime
  const handleCardInsert = useCallback((newCard: PipelineCard) => {
    console.log('✨ [Realtime Handler] Novo card recebido:', newCard);
    
    // Verificar se o card já existe (evitar duplicatas)
    setCards(prev => {
      const exists = prev.some(c => c.id === newCard.id);
      if (exists) {
        console.log('⚠️ [Realtime] Card já existe, ignorando INSERT');
        return prev;
      }
      
      // Adicionar novo card ao início da lista
      return [newCard, ...prev];
    });
  }, []);

  const handleCardUpdate = useCallback((updatedCard: PipelineCard) => {
    console.log('♻️ [Realtime Handler] Card atualizado:', updatedCard);
    
    setCards(prev => {
      // Encontrar e atualizar o card
      const index = prev.findIndex(c => c.id === updatedCard.id);
      
      if (index === -1) {
        // Card não existe localmente, adicionar (pode ter sido filtrado por permissões antes)
        console.log('ℹ️ [Realtime] Card não encontrado localmente, adicionando');
        return [updatedCard, ...prev];
      }
      
      // Atualizar card existente
      const newCards = [...prev];
      newCards[index] = { ...newCards[index], ...updatedCard };
      return newCards;
    });
  }, []);

  const handleCardDelete = useCallback((cardId: string) => {
    console.log('🗑️ [Realtime Handler] Card deletado:', cardId);
    
    setCards(prev => prev.filter(c => c.id !== cardId));
  }, []);

  const handleColumnInsert = useCallback((newColumn: PipelineColumn) => {
    console.log('✨ [Realtime Handler] Nova coluna recebida:', newColumn);
    
    setColumns(prev => {
      const exists = prev.some(c => c.id === newColumn.id);
      if (exists) return prev;
      
      return [...prev, newColumn].sort((a, b) => a.order_position - b.order_position);
    });
  }, []);

  const handleColumnUpdate = useCallback((updatedColumn: PipelineColumn) => {
    console.log('♻️ [Realtime Handler] Coluna atualizada:', updatedColumn);
    
    setColumns(prev => 
      prev.map(col => 
        col.id === updatedColumn.id ? { ...col, ...updatedColumn } : col
      ).sort((a, b) => a.order_position - b.order_position)
    );
  }, []);

  const handleColumnDelete = useCallback((columnId: string) => {
    console.log('🗑️ [Realtime Handler] Coluna deletada:', columnId);
    
    setColumns(prev => prev.filter(c => c.id !== columnId));
    
    // Remover cards da coluna deletada
    setCards(prev => prev.filter(c => c.column_id !== columnId));
  }, []);

  // Ativar realtime quando um pipeline é selecionado
  usePipelineRealtime({
    pipelineId: selectedPipeline?.id || null,
    onCardInsert: handleCardInsert,
    onCardUpdate: handleCardUpdate,
    onCardDelete: handleCardDelete,
    onColumnInsert: handleColumnInsert,
    onColumnUpdate: handleColumnUpdate,
    onColumnDelete: handleColumnDelete,
  });

  // Função reorderColumns como useCallback para evitar problemas com dependências
  const reorderColumns = useCallback(async (newColumns: PipelineColumn[]) => {
    try {
      console.log('🔄 Reordering columns from context');
      
      // Atualizar estado local primeiro  
      setColumns(newColumns);
      
      // Atualizar no backend
      const updates = newColumns.map((col, index) => ({
        id: col.id,
        order_position: index
      }));

      if (!getHeaders) {
        throw new Error('Headers not available');
      }

      for (const update of updates) {
        await supabase.functions.invoke('pipeline-management/columns', {
          method: 'PUT',
          headers: getHeaders,
          body: {
            id: update.id,
            order_position: update.order_position
          }
        });
      }

      // Re-fetch para garantir sincronização
      if (selectedPipeline?.id) {
        await fetchColumns(selectedPipeline.id);
        await fetchCards(selectedPipeline.id);
      }
      
      console.log('✅ Colunas reordenadas com sucesso');
      toast({
        title: "Sucesso",
        description: "Ordem das colunas atualizada",
      });
    } catch (error) {
      console.error('❌ Erro ao reordenar colunas:', error);
      toast({
        title: "Erro", 
        description: "Erro ao reordenar colunas",
        variant: "destructive",
      });
      // Reverter para o estado anterior em caso de erro
      if (selectedPipeline?.id) {
        await fetchColumns(selectedPipeline.id);
      }
    }
  }, [getHeaders, selectedPipeline, fetchColumns, fetchCards, toast]);

  // Buscar pipelines quando o workspace mudar
  useEffect(() => {
    if (selectedWorkspace?.workspace_id && getHeaders) {
      // Workspace changed - clearing and fetching pipelines
      // Limpar dados anteriores imediatamente para mostrar loading
      setColumns([]);
      setCards([]);
      setSelectedPipeline(null);
      
      // Buscar novos pipelines e forçar seleção do primeiro
      fetchPipelines(true);
    } else {
      setPipelines([]);
      setSelectedPipeline(null);
      setColumns([]);
      setCards([]);
    }
  }, [selectedWorkspace?.workspace_id, fetchPipelines, getHeaders]);

  // Buscar colunas e cards quando o pipeline selecionado mudar
  useEffect(() => {
    if (selectedPipeline?.id) {
      fetchColumns(selectedPipeline.id);
      fetchCards(selectedPipeline.id);
    } else {
      setColumns([]);
      setCards([]);
    }
  }, [selectedPipeline?.id, fetchColumns, fetchCards]);

  // Realtime subscription para pipeline_columns
  useEffect(() => {
    if (!selectedPipeline?.id) return;

    console.log('🔴 Setting up realtime subscription for pipeline_columns');

    const channel = supabase
      .channel('pipeline-columns-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${selectedPipeline.id}`
        },
        (payload) => {
          console.log('🔴 Realtime pipeline_columns change:', payload);
          
          // Refresh columns when any change occurs
          fetchColumns(selectedPipeline.id);
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up realtime subscription for pipeline_columns');
      supabase.removeChannel(channel);
    };
  }, [selectedPipeline?.id, fetchColumns]);

  // Realtime subscription para pipeline_cards - MELHORADO para capturar saídas
  useEffect(() => {
    if (!selectedPipeline?.id) return;

    console.log('🔴 Setting up realtime subscription for pipeline_cards');

    // Canal principal: cards que pertencem ao pipeline
    const mainChannel = supabase
      .channel('pipeline-cards-main')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${selectedPipeline.id}`
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          console.log('🔴 Realtime pipeline_cards change (main):', {
            eventType: payload.eventType,
            cardId: newRecord?.id || oldRecord?.id,
            pipelineId: newRecord?.pipeline_id || oldRecord?.pipeline_id,
            timestamp: new Date().toISOString()
          });
          
          // Refresh cards when any change occurs
          fetchCards(selectedPipeline.id);
        }
      )
      .subscribe();

    // Canal secundário: detectar quando cards SAEM do pipeline
    // (captura UPDATEs onde pipeline_id mudou SAINDO deste pipeline)
    const exitChannel = supabase
      .channel('pipeline-cards-exit')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pipeline_cards'
        },
        (payload) => {
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;
          const oldPipelineId = oldRecord?.pipeline_id;
          const newPipelineId = newRecord?.pipeline_id;
          
          // Se o card SAIU do pipeline atual
          if (oldPipelineId === selectedPipeline.id && newPipelineId !== selectedPipeline.id) {
            console.log('🚪 Card SAIU do pipeline atual:', {
              cardId: newRecord?.id,
              de: oldPipelineId,
              para: newPipelineId,
              timestamp: new Date().toISOString()
            });
            
            // Refresh para remover o card
            fetchCards(selectedPipeline.id);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up realtime subscriptions for pipeline_cards');
      supabase.removeChannel(mainChannel);
      supabase.removeChannel(exitChannel);
    };
  }, [selectedPipeline?.id, fetchCards]);

  const value = useMemo(() => ({
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    fetchPipelines,
    createPipeline,
    deletePipeline,
    selectPipeline,
    refreshCurrentPipeline,
    createColumn,
    createCard,
    updateCard,
    moveCard,
    moveCardOptimistic,
    getCardsByColumn,
    reorderColumns,
  }), [
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    fetchPipelines,
    createPipeline,
    deletePipeline,
    selectPipeline,
    refreshCurrentPipeline,
    createColumn,
    createCard,
    updateCard,
    moveCard,
    moveCardOptimistic,
    getCardsByColumn,
    reorderColumns,
  ]);

  return (
    <PipelinesContext.Provider value={value}>
      {children}
    </PipelinesContext.Provider>
  );
}

export function usePipelinesContext() {
  const context = useContext(PipelinesContext);
  if (context === undefined) {
    throw new Error('usePipelinesContext must be used within a PipelinesProvider');
  }
  return context;
}