import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePipelineRealtime } from '@/hooks/usePipelineRealtime';
import { generateRandomId } from '@/lib/generate-random-id';

const parseFunctionErrorBody = (error: any) => {
  const body = error?.context?.body;

  if (!body) return null;

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (parseError) {
      console.warn('⚠️ [PipelinesContext] Falha ao analisar corpo de erro da função:', parseError, body);
      return null;
    }
  }

  if (typeof body === 'object') {
    return body;
  }

  return null;
};

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
  icon?: string;
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
  products?: Array<{
    id: string;
    product_id: string | null;
    quantity: number;
    unit_value: number;
    total_value: number;
    product?: {
      id: string;
      name: string;
      value: number;
    };
  }>;
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
  createColumn: (name: string, color: string, icon?: string) => Promise<PipelineColumn>;
  createCard: (cardData: Partial<PipelineCard>) => Promise<PipelineCard>;
  updateCard: (cardId: string, updates: Partial<PipelineCard>) => Promise<void>;
  moveCard: (cardId: string, newColumnId: string) => Promise<void>;
  moveCardOptimistic: (cardId: string, newColumnId: string) => Promise<void>;
  getCardsByColumn: (columnId: string) => PipelineCard[];
  reorderColumns: (newColumns: PipelineColumn[]) => Promise<void>;
  updateConversationAgentStatus: (conversationId: string, agente_ativo: boolean, agent_active_id?: string | null) => void;
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
  
  // 🔥 Ref para armazenar timeouts pendentes de movimentação de cards
  const pendingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

      // Ordenar pipelines: pipeline padrão primeiro, depois por created_at desc
      let sortedPipelines = data || [];
      if (sortedPipelines.length > 0 && selectedWorkspace?.workspace_id) {
        // Buscar workspace para pegar default_pipeline_id
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('default_pipeline_id')
          .eq('id', selectedWorkspace.workspace_id)
          .single();
        
        if (workspaceData?.default_pipeline_id) {
          const defaultPipeline = sortedPipelines.find(p => p.id === workspaceData.default_pipeline_id);
          if (defaultPipeline) {
            // Remover a pipeline padrão da lista e colocá-la no início
            sortedPipelines = [
              defaultPipeline,
              ...sortedPipelines.filter(p => p.id !== workspaceData.default_pipeline_id)
            ];
          }
        }
      }

      setPipelines(sortedPipelines);
      
      // Auto-select first pipeline if forced or if none selected and we have pipelines
      if (sortedPipelines.length > 0 && (forceSelectFirst || !selectedPipeline)) {
        // Auto-selecting first pipeline (que agora é a padrão se houver)
        setSelectedPipeline(sortedPipelines[0]);
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

  const fetchCards = useCallback(async (pipelineId: string, retryCount = 0) => {
    if (!getHeaders || !pipelineId) return;

    try {
      console.log(`🔍 [fetchCards] Buscando cards para pipeline: ${pipelineId} (tentativa ${retryCount + 1})`);
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: getHeaders
      });

      if (error) throw error;
      
      const cardsData = data || [];
      console.log(`✅ [fetchCards] ${cardsData.length} cards carregados`);
      
      // ✅ VERIFICAR SE CARDS TÊM RELACIONAMENTOS COMPLETOS
      const cardsWithFullData = cardsData.filter(c => c.contact || c.conversation);
      const cardsWithoutData = cardsData.filter(c => !c.contact && !c.conversation && (c.contact_id || c.conversation_id));
      
      if (cardsWithoutData.length > 0) {
        console.warn(`⚠️ [fetchCards] ${cardsWithoutData.length} cards sem relacionamentos detectados`);
        
        // Se for primeira tentativa e houver cards incompletos, tentar novamente após 2s
        if (retryCount === 0) {
          console.log('🔄 [fetchCards] Tentando novamente em 2 segundos...');
          setTimeout(() => fetchCards(pipelineId, 1), 2000);
          return; // Não atualizar ainda, aguardar retry
        }
      }
      
      const sanitizedCards = (cardsData || []).filter(card => {
        if (userRole !== 'user') return true;

        const userData = localStorage.getItem('currentUser');
        const currentUserData = userData ? JSON.parse(userData) : null;
        const currentUserId = currentUserData?.id;
        const responsibleId = (card as any).responsible_user_id || (card as any).responsible_user?.id || null;
        const isUnassigned = !responsibleId;
        const isAssignedToCurrentUser = responsibleId === currentUserId;

        if (!isUnassigned && !isAssignedToCurrentUser) {
          console.log('🚫 [fetchCards] Removendo card por permissão de usuário:', {
            cardId: card.id,
            responsible_user_id: (card as any).responsible_user_id,
            responsible_user: (card as any).responsible_user,
            currentUserId
          });
          return false;
        }

        return true;
      });

      setCards(sanitizedCards);
    } catch (error) {
      console.error('❌ [fetchCards] Erro ao buscar cards:', error);
      
      // Retry em caso de erro (máximo 2 tentativas)
      if (retryCount < 2) {
        console.log(`🔄 [fetchCards] Tentando novamente (${retryCount + 1}/2)...`);
        setTimeout(() => fetchCards(pipelineId, retryCount + 1), 2000);
        return;
      }
      
      toast({
        title: "Erro",
        description: "Erro ao carregar cards. Tente recarregar a página.",
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

  const createColumn = useCallback(async (name: string, color: string, icon: string = 'Circle') => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'POST',
        headers: getHeaders,
        body: { 
          pipeline_id: selectedPipeline.id,
          name,
          color,
          icon
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
    const tempCardId = generateRandomId();
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
        const parsedError = parseFunctionErrorBody(error);
        console.error('❌ Erro ao criar card no backend:', {
          error,
          parsedError
        });
        // Remover card otimista em caso de erro
        setCards(prev => prev.filter(c => c.id !== tempCardId));
        
        // Verificar se é erro de card duplicado
        if (error.message?.includes('Já existe um card aberto') || 
            error.message?.includes('duplicate_open_card') ||
            parsedError?.error === 'duplicate_open_card') {
          toast({
            title: "Negócio já existe",
            description: "Este contato já possui um negócio aberto neste pipeline. Finalize o anterior antes de criar um novo.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro",
            description: parsedError?.message || "Erro ao criar card",
            variant: "destructive",
          });
        }
        
        throw error;
      }

      // Substituir card temporário pelo real retornado do backend
      setCards(prev => prev.map(c => c.id === tempCardId ? data : c));
      
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso",
      });

      return data;
    } catch (error: any) {
      const parsedError = parseFunctionErrorBody(error);
      console.error('❌ Error creating card:', {
        error,
        parsedError
      });
      
      // Verificar se é erro de card duplicado (do trigger do banco)
      if (error.message?.includes('Já existe um card aberto') || 
          error.message?.includes('duplicate_open_card') ||
          parsedError?.error === 'duplicate_open_card') {
        toast({
          title: "Negócio já existe",
          description: "Este contato já possui um negócio aberto neste pipeline. Finalize o anterior antes de criar um novo.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: parsedError?.message || "Erro ao criar card",
          variant: "destructive",
        });
      }
      
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

      // Se a atualização mudou a coluna, emitir broadcast como fallback
      if (updates.column_id && selectedPipeline?.id) {
        try {
          const channelName = `pipeline-${selectedPipeline.id}`;
          const existing = (supabase.getChannels?.() || []).find((c: any) => c?.topic === channelName);
          if (existing) {
            console.log('📡 [Broadcast] updateCard: enviando pipeline-card-moved via canal existente');
            const ok = await existing.send({
              type: 'broadcast',
              event: 'pipeline-card-moved',
              payload: { cardId, newColumnId: updates.column_id }
            });
            console.log('📡 [Broadcast] updateCard enviado:', ok);
          }
        } catch (err) {
          console.warn('⚠️ [Broadcast] updateCard: falha ao enviar broadcast', err);
        }
      }

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
    const previousCards = [...cards];
    const cardToMove = cards.find(c => c.id === cardId);
    
    if (!cardToMove) return;

    console.log('🚀 [Optimistic] Movendo card instantaneamente:', {
      cardId,
      fromColumn: cardToMove.column_id,
      toColumn: newColumnId,
      timestamp: new Date().toISOString()
    });

    // Atualização otimista local (apenas visual)
    const optimisticTimestamp = new Date().toISOString();
    setCards(prev => prev.map(card => 
      card.id === cardId 
        ? { 
            ...card, 
            column_id: newColumnId, 
            updated_at: optimisticTimestamp 
          }
        : card
    ));

    try {
      if (!getHeaders) throw new Error('Headers not available');

      console.log('📤 [Optimistic] Enviando para backend...');
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers: getHeaders,
        body: { column_id: newColumnId }
      });

      if (error) throw error;

      console.log('✅ [Optimistic] Backend confirmou mudança');
      console.log('⏳ [Optimistic] Aguardando evento realtime...');

      // Enviar broadcast manual para garantir atualização cross-aba mesmo se o evento do DB não chegar
      try {
        if (selectedPipeline?.id) {
          const channelName = `pipeline-${selectedPipeline.id}`;
          // Tentar reutilizar canal existente (criado pelo hook usePipelineRealtime)
          const existing = (supabase.getChannels?.() || []).find((c: any) => c?.topic === channelName);
          if (existing) {
            console.log('📡 [Broadcast] Usando canal existente para enviar pipeline-card-moved');
            const ok = await existing.send({
              type: 'broadcast',
              event: 'pipeline-card-moved',
              payload: { cardId, newColumnId }
            });
            console.log('📡 [Broadcast] Enviado via canal existente:', ok);
          } else {
            console.log('📡 [Broadcast] Canal inexistente, criando e assinando para enviar...');
            const tempChannel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
            await tempChannel.subscribe();
            const ok = await tempChannel.send({
              type: 'broadcast',
              event: 'pipeline-card-moved',
              payload: { cardId, newColumnId }
            });
            console.log('📡 [Broadcast] Enviado via canal temporário:', ok);
            // Remover canal temporário após tentativa
            supabase.removeChannel(tempChannel);
          }
        }
      } catch (broadcastErr) {
        console.error('❌ [Broadcast] Falha ao enviar broadcast de movimento de card:', broadcastErr);
      }

      // O evento realtime vai atualizar o estado com o timestamp correto do banco
      // Não fazemos nada aqui para evitar duplicação

      // ✅ Cancelar timeout anterior se existir
      const existingTimeout = pendingTimeoutsRef.current.get(cardId);
      if (existingTimeout) {
        console.log('🚫 [Optimistic] Cancelando timeout anterior para card:', cardId);
        clearTimeout(existingTimeout);
      }

      // ✅ Timeout de segurança: se realtime não chegar em 3s, forçar atualização
      const timeoutId = setTimeout(() => {
        console.warn('⏰ [Realtime] Timeout - forçando atualização local');
        
        setCards(prev => prev.map(card => 
          card.id === cardId 
            ? { ...card, column_id: newColumnId }
            : card
        ));
        
        // Remover timeout da lista após execução
        pendingTimeoutsRef.current.delete(cardId);
      }, 3000);
      
      // Armazenar timeout para possível cancelamento
      pendingTimeoutsRef.current.set(cardId, timeoutId);

    } catch (error) {
      console.error('❌ [Optimistic] Erro - revertendo:', error);
      
      setCards(previousCards);
      
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
        const responsibleId = card.responsible_user_id || (card.responsible_user as any)?.id || null;
        const isUnassigned = !responsibleId;
        const isAssignedToCurrentUser = responsibleId === currentUserId;
        
        if (!isUnassigned && !isAssignedToCurrentUser) {
          console.log('🚫 [getCardsByColumn] Ocultando card para usuário comum:', {
            cardId: card.id,
            columnId,
            responsible_user_id: card.responsible_user_id,
            responsible_user: card.responsible_user,
            currentUserId
          });
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
  const handleCardInsert = useCallback(async (newCard: PipelineCard) => {
    console.log('✨ [Realtime Handler] Novo card recebido:', newCard);
    
    // Atualizar timestamp de realtime
    if ((window as any).__updateRealtimeTimestamp) {
      (window as any).__updateRealtimeTimestamp();
    }
    
    // Verificar se o card já existe (evitar duplicatas)
    setCards(prev => {
      const exists = prev.some(c => c.id === newCard.id);
      if (exists) {
        console.log('⚠️ [Realtime] Card já existe, ignorando INSERT');
        return prev;
      }
      return prev; // Retornar prev temporariamente enquanto busca dados completos
    });

    // ✅ BUSCAR DADOS COMPLETOS do card (contact, conversation) se não vierem no realtime
    // O realtime do Supabase não envia relacionamentos por padrão
    const hasFullData = newCard.contact && newCard.conversation;
    
    if (!hasFullData && selectedPipeline?.id && getHeaders) {
      console.log('🔄 [Realtime] Card sem relacionamentos, buscando dados completos...');
      
      try {
        const { data: fullCard, error } = await supabase.functions.invoke(
          `pipeline-management/cards?id=${newCard.id}`,
          {
            method: 'GET',
            headers: getHeaders
          }
        );

        if (error) throw error;

        if (fullCard) {
          console.log('✅ [Realtime] Dados completos recebidos:', fullCard);
          
          setCards(prev => {
            const exists = prev.some(c => c.id === fullCard.id);
            if (exists) {
              // Atualizar card existente com dados completos
              return prev.map(c => c.id === fullCard.id ? fullCard : c);
            }
            // Adicionar novo card ao início da lista com dados completos
            return [fullCard, ...prev];
          });
          
          return;
        }
      } catch (error) {
        console.error('❌ [Realtime] Erro ao buscar dados completos do card:', error);
        // Fallback: adicionar card mesmo sem relacionamentos
      }
    }

    // Adicionar card mesmo sem relacionamentos (fallback)
    setCards(prev => {
      const exists = prev.some(c => c.id === newCard.id);
      if (exists) return prev;
      
      console.log('📦 [Realtime] Adicionando card sem relacionamentos (será atualizado no próximo fetch)');
      return [newCard, ...prev];
    });
  }, [selectedPipeline?.id, getHeaders]);

  const handleCardUpdate = useCallback(async (updatedCard: PipelineCard) => {
    console.log('♻️ [Realtime Handler] Card atualizado:', updatedCard);
    
    // Atualizar timestamp de realtime
    if ((window as any).__updateRealtimeTimestamp) {
      (window as any).__updateRealtimeTimestamp();
    }
    
    // Detectar se é um evento de refresh de tags de contato
    const isContactRefresh = (updatedCard as any)._refresh && (updatedCard.id as string).startsWith('refresh-contact-');
    
    if (isContactRefresh) {
      const contactId = (updatedCard.id as string).replace('refresh-contact-', '');
      console.log('🏷️ [Realtime] Refresh de tags para contato:', contactId);
      
      if (!getHeaders) {
        console.warn('⚠️ [Realtime] Headers não disponíveis para refresh');
        return;
      }
      
      // 🔥 Obter snapshot do estado atual para buscar os cards
      setCards((currentCards) => {
        // Identificar cards que precisam refresh
        const cardsToRefresh = currentCards.filter(c => c.contact_id === contactId);
        console.log(`🔄 [Realtime] ${cardsToRefresh.length} card(s) encontrado(s) para refresh`);
        
        if (cardsToRefresh.length === 0) {
          console.log('ℹ️ [Realtime] Nenhum card encontrado para este contato');
          return currentCards;
        }
        
        // Executar fetches em paralelo e atualizar quando completos
        Promise.all(
          cardsToRefresh.map(cardToRefresh =>
            supabase.functions.invoke(
              `pipeline-management/cards?id=${cardToRefresh.id}`,
              { method: 'GET', headers: getHeaders }
            )
          )
        ).then((results) => {
          // Processar resultados
          const updatedCards = results
            .map(({ data, error }) => {
              if (error) {
                console.error('❌ [Realtime] Erro ao buscar card:', error);
                return null;
              }
              return data;
            })
            .filter(Boolean) as PipelineCard[];
          
          if (updatedCards.length > 0) {
            console.log(`✅ [Realtime] ${updatedCards.length} card(s) atualizado(s) com novas tags`);
            
            // Atualizar estado com os cards atualizados
            setCards(current => 
              current.map(c => {
                const updated = updatedCards.find(uc => uc.id === c.id);
                return updated || c;
              })
            );
          }
        }).catch((err) => {
          console.error('❌ [Realtime] Erro ao atualizar cards:', err);
        });
        
        // Retornar estado atual imediatamente (updates virão depois)
        return currentCards;
      });
      
      return; // Não processar como update normal
    }
    
    // Se o card atualizado não tem relacionamentos e o card local tinha, preservar
    setCards(prev => {
      console.log('🔄 [Realtime] setCards callback executado');
      console.log('📊 [Realtime] Cards no estado anterior:', prev.length);
      
      const index = prev.findIndex(c => c.id === updatedCard.id);
      console.log('🔍 [Realtime] Índice do card:', index === -1 ? 'NÃO ENCONTRADO' : index);
      
      if (index === -1) {
        console.log('ℹ️ [Realtime] Card não encontrado localmente, buscando dados completos...');
        
        // Buscar dados completos do card ausente
        if (selectedPipeline?.id && getHeaders) {
          (async () => {
            try {
              const { data: fullCard, error } = await supabase.functions.invoke(
                `pipeline-management/cards?id=${updatedCard.id}`,
                {
                  method: 'GET',
                  headers: getHeaders
                }
              );

              if (!error && fullCard) {
                console.log('✅ [Realtime] Card completo recebido:', fullCard);
                setCards(p => {
                  const exists = p.some(c => c.id === fullCard.id);
                  if (exists) {
                    // Atualizar card existente preservando relacionamentos
                    const existingIndex = p.findIndex(c => c.id === fullCard.id);
                    const existingCard = p[existingIndex];
                    const mergedCard = {
                      ...fullCard,
                      contact: fullCard.contact || existingCard.contact,
                      conversation: fullCard.conversation || existingCard.conversation,
                    };
                    const newCards = [...p];
                    newCards[existingIndex] = mergedCard;
                    console.log('✅ [Realtime] Card atualizado após busca completa');
                    return newCards;
                  }
                  console.log('✅ [Realtime] Card adicionado após busca completa');
                  return [fullCard, ...p];
                });
              } else {
                // Fallback: adicionar card mesmo sem relacionamentos
                console.log('⚠️ [Realtime] Adicionando card sem relacionamentos (fallback)');
                setCards(p => [updatedCard, ...p]);
              }
            } catch (err) {
              console.error('❌ [Realtime] Erro ao buscar card completo:', err);
              setCards(p => [updatedCard, ...p]);
            }
          })();
        }
        
        return prev; // Retornar prev enquanto busca
      }
      
      // ✅ PRESERVAR relacionamentos existentes se o update não trouxer
      const existingCard = prev[index];
      console.log('📋 [Realtime] Card existente encontrado:', {
        id: existingCard.id,
        column_id: existingCard.column_id,
        title: existingCard.title
      });
      
      // ✅ DETECTAR MUDANÇA DE COLUNA para logs claros
      const columnChanged = existingCard.column_id !== updatedCard.column_id;
      if (columnChanged) {
        console.log('🔄 [Realtime] ⚠️⚠️⚠️ MUDANÇA DE COLUNA DETECTADA ⚠️⚠️⚠️:', {
          cardId: updatedCard.id,
          cardTitle: updatedCard.title || existingCard.title,
          fromColumn: existingCard.column_id,
          toColumn: updatedCard.column_id,
          timestamp: new Date().toISOString()
        });
        
        // 🔥 CANCELAR TIMEOUT PENDENTE - evento realtime chegou!
        const pendingTimeout = pendingTimeoutsRef.current.get(updatedCard.id);
        if (pendingTimeout) {
          console.log('✅ [Realtime] Cancelando timeout pendente - evento chegou a tempo!');
          clearTimeout(pendingTimeout);
          pendingTimeoutsRef.current.delete(updatedCard.id);
        }
      } else {
        console.log('ℹ️ [Realtime] Update detectado (mesma coluna)');
      }
      
      // 🔥 BUSCAR DADOS COMPLETOS ATUALIZADOS sempre que houver qualquer update
      // (automações podem modificar tags, agentes, etc sem mudar coluna)
      if (getHeaders) {
        console.log('🔍 [Realtime] Buscando dados completos do card atualizado:', updatedCard.id);
        supabase.functions.invoke(
          `pipeline-management/cards?id=${updatedCard.id}`,
          {
            method: 'GET',
            headers: getHeaders
          }
        ).then(({ data: fullCard, error }) => {
          if (error) {
            console.error('❌ Erro ao buscar card completo:', error);
            return;
          }
          
          if (fullCard) {
            console.log('✅ [Realtime] Card completo atualizado:', {
              id: fullCard.id,
              column_id: fullCard.column_id,
              tags: fullCard.contact?.tags?.length || 0,
              hasAgent: !!fullCard.conversation?.agente_ativo
            });
            
            // Atualizar o card com dados completos do backend
            setCards(current => 
              current.map(c => 
                c.id === fullCard.id 
                  ? fullCard
                  : c
              )
            );
          }
        });
      }
      
      const mergedCard = {
        ...updatedCard,
        // Preservar contact se não vier no update
        contact: updatedCard.contact || existingCard.contact,
        // Preservar conversation se não vier no update
        conversation: updatedCard.conversation || existingCard.conversation,
      };
      
      // ✅ SEMPRE APLICAR ATUALIZAÇÃO REALTIME (fonte autoritativa do servidor)
      console.log('🔄 [Realtime] Aplicando atualização do servidor', {
        cardId: mergedCard.id,
        columnChanged,
        newColumnId: mergedCard.column_id,
        oldColumnId: existingCard.column_id
      });
      
      const newCards = [...prev];
      newCards[index] = mergedCard;
      
      console.log('✅ [Realtime] Novo estado criado:', {
        totalCards: newCards.length,
        cardAtualizado: newCards[index].column_id,
        cardAnterior: existingCard.column_id
      });
      
      return newCards;
    });
  }, [selectedPipeline?.id, getHeaders]);

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
    
    // Atualizar timestamp de realtime
    if ((window as any).__updateRealtimeTimestamp) {
      (window as any).__updateRealtimeTimestamp();
    }
    
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

  // 🤖 Handler para atualização de conversation via realtime
  const handleConversationUpdate = useCallback((conversationId: string, updates: any) => {
    console.log('🤖 [Context] Atualizando conversation via realtime:', { conversationId, updates });
    
    setCards(current => 
      current.map(card => {
        if (card.conversation_id === conversationId && card.conversation) {
          return {
            ...card,
            conversation: {
              ...card.conversation,
              ...updates
            }
          };
        }
        return card;
      })
    );
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
    onConversationUpdate: handleConversationUpdate,
  });

  // Função reorderColumns como useCallback para evitar problemas com dependências
  const reorderColumns = useCallback(async (newColumns: PipelineColumn[]) => {
    try {
      console.log('🔄 Reordenando colunas otimisticamente');
      
      // ✅ Atualizar estado local IMEDIATAMENTE para UX fluida
      setColumns(newColumns);
      
      // Atualizar no backend em paralelo (não bloqueia UI)
      const updates = newColumns.map((col, index) => ({
        id: col.id,
        order_position: index
      }));

      if (!getHeaders) {
        throw new Error('Headers not available');
      }

      // 🚀 Fazer todas as requisições em PARALELO ao invés de sequencial
      await Promise.all(
        updates.map(update =>
          supabase.functions.invoke(`pipeline-management/columns?id=${update.id}`, {
            method: 'PUT',
            headers: getHeaders,
            body: {
              order_position: update.order_position
            }
          })
        )
      );

      // ✅ Não fazer re-fetch - deixar o realtime sincronizar naturalmente
      console.log('✅ Colunas reordenadas no backend');
      
      // ✅ SEM TOAST - ação é instantânea e não precisa de feedback
    } catch (error) {
      console.error('❌ Erro ao reordenar colunas:', error);
      
      // Só mostrar toast em caso de ERRO
      toast({
        title: "Erro ao reordenar", 
        description: "Não foi possível salvar a nova ordem",
        variant: "destructive",
      });
      
      // Reverter para o estado anterior em caso de erro
      if (selectedPipeline?.id) {
        await fetchColumns(selectedPipeline.id);
      }
    }
  }, [getHeaders, selectedPipeline, fetchColumns, toast]);

  // ✅ DEBUG: Monitorar mudanças nos cards para verificar se realtime está funcionando
  useEffect(() => {
    console.log('📊 [Cards State] Cards atualizados:', cards.length, 'total');
    if (selectedPipeline?.id) {
      const cardsByColumn = columns.reduce((acc, col) => {
        acc[col.id] = cards.filter(c => c.column_id === col.id).length;
        return acc;
      }, {} as Record<string, number>);
      console.log('📊 [Cards State] Distribuição por coluna:', cardsByColumn);
    }
  }, [cards, columns, selectedPipeline?.id]);

  // Buscar pipelines quando o workspace mudar
  useEffect(() => {
    console.log('🔍 [PipelinesContext] useEffect triggered:', {
      hasWorkspace: !!selectedWorkspace?.workspace_id,
      hasHeaders: !!getHeaders,
      workspaceId: selectedWorkspace?.workspace_id
    });
    
    if (selectedWorkspace?.workspace_id && getHeaders) {
      console.log('✅ [PipelinesContext] Conditions met, fetching pipelines...');
      // Workspace changed - clearing and fetching pipelines
      // Limpar dados anteriores imediatamente para mostrar loading
      setColumns([]);
      setCards([]);
      setSelectedPipeline(null);
      
      // Buscar novos pipelines e forçar seleção do primeiro
      fetchPipelines(true);
    } else {
      console.log('⚠️ [PipelinesContext] Conditions not met, clearing pipelines');
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

  // ✅ REFETCH INTELIGENTE: Garantir que cards apareçam mesmo se realtime falhar
  useEffect(() => {
    if (!selectedPipeline?.id) return;

    let lastFetchTime = Date.now();
    let lastRealtimeUpdate = Date.now();
    let consecutiveEmptyFetches = 0;

    // Função para atualizar timestamp de realtime (será chamada pelos handlers)
    const updateRealtimeTimestamp = () => {
      lastRealtimeUpdate = Date.now();
    };

    // Expor função para handlers
    (window as any).__updateRealtimeTimestamp = updateRealtimeTimestamp;

    // Refetch apenas quando necessário:
    // 1. Cards incompletos (sem contact/conversation)
    // 2. Pipeline sem atualizações realtime há mais de 60s
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime;
      const timeSinceLastRealtime = now - lastRealtimeUpdate;
      
      // Verificar cards incompletos
      const hasIncompleteCards = cards.some(c => 
        (c.contact_id && !c.contact) || 
        (c.conversation_id && !c.conversation)
      );
      
      // Se há cards incompletos, refetch imediatamente
      if (hasIncompleteCards) {
        console.log('🔄 [Refetch] Cards incompletos detectados, refazendo fetch...');
        fetchCards(selectedPipeline.id);
        lastFetchTime = now;
        consecutiveEmptyFetches = 0;
        return;
      }
      
      // Se passou muito tempo desde última atualização realtime e não há cards
      // (pode ter sido criado mas evento não chegou)
      if (
        timeSinceLastRealtime > 60000 && 
        timeSinceLastFetch > 30000 && 
        cards.length === 0 && 
        consecutiveEmptyFetches < 3
      ) {
        console.log('🔄 [Refetch] Sem atualizações realtime há muito tempo, verificando...');
        fetchCards(selectedPipeline.id);
        lastFetchTime = now;
        consecutiveEmptyFetches++;
        return;
      }
      
      // Reset contador se houver cards
      if (cards.length > 0) {
        consecutiveEmptyFetches = 0;
      }
    }, 15000); // Verificar a cada 15 segundos (reduzido de 5s)

    return () => {
      clearInterval(interval);
      delete (window as any).__updateRealtimeTimestamp;
    };
  }, [selectedPipeline?.id, cards, fetchCards]);

  // Função para atualizar otimisticamente o status do agente de uma conversa
  const updateConversationAgentStatus = useCallback((
    conversationId: string, 
    agente_ativo: boolean, 
    agent_active_id?: string | null
  ) => {
    console.log('🤖 [Context] Update otimista agente:', { conversationId, agente_ativo, agent_active_id });
    
    setCards(current => 
      current.map(card => {
        if (card.conversation_id === conversationId && card.conversation) {
          return {
            ...card,
            conversation: {
              ...card.conversation,
              agente_ativo,
              agent_active_id: agent_active_id !== undefined ? agent_active_id : card.conversation.agent_active_id
            }
          };
        }
        return card;
      })
    );
  }, []);

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
    updateConversationAgentStatus,
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
    updateConversationAgentStatus,
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