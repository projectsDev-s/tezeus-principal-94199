import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender_type: 'contact' | 'agent';
  sender_id?: string;
  file_url?: string;
  file_name?: string;
  mime_type?: string;
  created_at: string;
  status?: string; // Status pode vir do Evolution como 'DELIVERY_ACK', 'READ_ACK', etc.
  delivered_at?: string;
  read_at?: string;
  external_id?: string;
  metadata?: any;
  workspace_id?: string;
}

interface UseConversationMessagesReturn {
  messages: WhatsAppMessage[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadInitial: (conversationId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  addMessage: (message: WhatsAppMessage) => void;
  updateMessage: (messageId: string, updates: Partial<WhatsAppMessage>) => void;
  removeMessage: (messageId: string) => void; // ✅ NOVO
  clearMessages: () => void;
}

// ✅ MAPEAMENTO DE ACK PARA STATUS
function mapAckToStatus(ack?: number): string {
  switch(ack) {
    case 1: return 'sent';
    case 2: return 'delivered';
    case 3: return 'read';
    default: return 'sent';
  }
}

export function useConversationMessages(): UseConversationMessagesReturn {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursorBefore, setCursorBefore] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  
  // Cache em memória para evitar re-fetch desnecessário
  const cacheRef = useRef<Map<string, { messages: WhatsAppMessage[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 2000; // 2 segundos
  
  // ✅ DEDUP: Prevenir processamento duplicado de mensagens
  const seenRef = useRef<Set<string>>(new Set());

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(null);
  }, []);

  const loadInitial = useCallback(async (conversationId: string) => {
    console.log('🔄 loadInitial chamado para conversationId:', conversationId);
    
    if (!selectedWorkspace?.workspace_id) {
      console.error('❌ Nenhum workspace selecionado!');
      return;
    }

    // ✅ SEMPRE invalidar cache ao carregar inicial (buscar dados frescos)
    const cacheKey = `${selectedWorkspace.workspace_id}:${conversationId}`;
    cacheRef.current.delete(cacheKey);

    setLoading(true);
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(conversationId);

    try {
      const headers = getHeaders();
      console.log('📤 Chamando whatsapp-get-messages com headers:', headers);

      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: conversationId,
          limit: 6
        },
        headers
      });

      console.log('📥 Resposta do whatsapp-get-messages:', { data, error });

      if (error) {
        console.error('Error loading initial messages:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar mensagens",
          variant: "destructive",
        });
        return;
      }

      const newMessages = data?.items || [];
      setMessages(newMessages);
      setHasMore(!!data?.nextBefore);
      setCursorBefore(data?.nextBefore || null);

      // Cache em memória
      cacheRef.current.set(cacheKey, {
        messages: newMessages,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Unexpected error loading messages:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace?.workspace_id, toast]);

  const loadMore = useCallback(async () => {
    if (!selectedWorkspace?.workspace_id || !currentConversationId || !cursorBefore || loadingMore || !hasMore) {
      console.log('⏭️ loadMore ignorado:', {
        hasWorkspace: !!selectedWorkspace?.workspace_id,
        hasConversationId: !!currentConversationId,
        hasCursor: !!cursorBefore,
        isLoadingMore: loadingMore,
        hasMore
      });
      return;
    }

    console.log('📜 Carregando mais mensagens...', {
      currentConversationId,
      cursorBefore,
      messagesCount: messages.length
    });

    setLoadingMore(true);

    try {
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: currentConversationId,
          limit: 6,
          before: cursorBefore
        },
        headers
      });

      if (error) {
        console.error('Error loading more messages:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar mais mensagens",
          variant: "destructive",
        });
        return;
      }

      const newMessages = data?.items || [];
      
      console.log('📥 Mensagens antigas recebidas:', {
        count: newMessages.length,
        hasNext: !!data?.nextBefore,
        firstMessage: newMessages[0],
        imagesCount: newMessages.filter((m: WhatsAppMessage) => m.message_type === 'image').length,
        sampleImage: newMessages.find((m: WhatsAppMessage) => m.message_type === 'image')
      });
      
      if (newMessages.length === 0) {
        console.log('✅ Sem mais mensagens antigas');
        setHasMore(false);
        return;
      }

      console.log('🔍 Antes de adicionar mensagens antigas:', {
        mensagensAntigas: newMessages.length,
        mensagensAtuais: messages.length,
        totalAposCarregar: newMessages.length + messages.length
      });

      // Concatenar mensagens antigas no início
      setMessages(prevMessages => [...newMessages, ...prevMessages]);
      setHasMore(!!data?.nextBefore);
      setCursorBefore(data?.nextBefore || null);

      // Atualizar cache
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      const updatedMessages = [...newMessages, ...messages];
      cacheRef.current.set(cacheKey, {
        messages: updatedMessages,
        timestamp: Date.now()
      });

      console.log('✅ Mensagens antigas carregadas - NÃO deve haver scroll automático');

    } catch (error) {
      console.error('Unexpected error loading more messages:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar mais mensagens",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId, cursorBefore, loadingMore, hasMore, messages, toast, getHeaders]);

  const addMessage = useCallback((message: WhatsAppMessage) => {
    console.log('📨 [addMessage] Tentando adicionar mensagem:', {
      id: message.id,
      sender_type: message.sender_type,
      conversation_id: message.conversation_id,
      content_preview: message.content?.substring(0, 30),
      stack_trace: new Error().stack // ✅ CRITICAL: Ver de onde está sendo chamado
    });
    
    // ✅ DEDUP: Usar conversation_id + message_id como chave única
    const dedupKey = `${message.conversation_id}_${message.id}`;
    
    if (seenRef.current.has(dedupKey)) {
      console.log(`⏭️ [addMessage] BLOQUEADO - Mensagem duplicada ignorada (dedup): ${dedupKey}`);
      return;
    }
    
    setMessages(prevMessages => {
      // ✅ VERIFICAR se já existe (proteção adicional)
      const exists = prevMessages.some(m => m.id === message.id);
      
      if (exists) {
        console.log(`⏭️ [addMessage] BLOQUEADO - Mensagem já existe no state: ${message.id}`);
        return prevMessages;
      }

      console.log('✅ [addMessage] Mensagem nova, adicionando ao state:', {
        id: message.id,
        sender_type: message.sender_type,
        content_preview: message.content?.substring(0, 30),
        total_messages_after: prevMessages.length + 1
      });
      
      // Marcar como vista
      seenRef.current.add(dedupKey);
      
      // Limpar Set após 30s para liberar memória
      setTimeout(() => seenRef.current.delete(dedupKey), 30000);
      
      // Adicionar no final (mensagem mais recente) e ordenar por created_at
      return [...prevMessages, message].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Invalidar cache para forçar refresh na próxima carga
    if (selectedWorkspace?.workspace_id && currentConversationId) {
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      cacheRef.current.delete(cacheKey);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId]);

  // ✅ NOVO: Função para remover mensagem por ID
  const removeMessage = useCallback((messageId: string) => {
    console.log('🗑️ [removeMessage] Removendo mensagem:', messageId);
    
    setMessages(prevMessages => {
      const filtered = prevMessages.filter(m => m.id !== messageId);
      console.log('✅ [removeMessage] Mensagem removida:', {
        messageId,
        totalBefore: prevMessages.length,
        totalAfter: filtered.length
      });
      return filtered;
    });

    // Limpar do Set de mensagens vistas
    if (selectedWorkspace?.workspace_id && currentConversationId) {
      const dedupKey = `${currentConversationId}_${messageId}`;
      seenRef.current.delete(dedupKey);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId]);

  const updateMessage = useCallback((messageId: string, updates: Partial<WhatsAppMessage>) => {
    console.log('🔄 updateMessage chamado:', { messageId, updates });
    
    setMessages(prevMessages => {
      const messageIndex = prevMessages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.log('⚠️ Mensagem não encontrada para atualizar:', messageId);
        return prevMessages;
      }

      const currentMessage = prevMessages[messageIndex];
      
      // ✅ CRÍTICO: Se está mudando o ID (de temporário para real)
      if (updates.id && updates.id !== messageId) {
        console.log('🔄 Tentando mudar ID de temporário para real:', { 
          oldId: messageId, 
          newId: updates.id 
        });
        
        // Verificar se já existe mensagem com o novo ID
        const existingIndex = prevMessages.findIndex(m => m.id === updates.id);
        if (existingIndex !== -1) {
          console.log('⚠️ JÁ EXISTE mensagem com o ID real, REMOVENDO a temporária:', updates.id);
          // ✅ Já existe → remover a temporária
          return prevMessages.filter(m => m.id !== messageId);
        }
        
        // ✅ Se não existe, atualizar o ID da mensagem temporária
        console.log('✅ Não existe mensagem com ID real, atualizando temporária');
      }
      
      // Atualizar a mensagem
      const updatedMessages = [...prevMessages];
      updatedMessages[messageIndex] = { ...currentMessage, ...updates };
      
      console.log('✏️ Mensagem atualizada:', { 
        id: updatedMessages[messageIndex].id, 
        status: updatedMessages[messageIndex].status,
        message_type: updatedMessages[messageIndex].message_type
      });
      
      return updatedMessages;
    });

    // Invalidar cache
    if (selectedWorkspace?.workspace_id && currentConversationId) {
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      cacheRef.current.delete(cacheKey);
    }
   }, [selectedWorkspace?.workspace_id, currentConversationId]);

  // Limpar cache quando o workspace muda (sem recarregar automaticamente)
  useEffect(() => {
    if (selectedWorkspace?.workspace_id) {
      cacheRef.current.clear();
      console.log('🗑️ Cache limpo devido à mudança de workspace');
    }
  }, [selectedWorkspace?.workspace_id]);

  // Limpar cache antigo a cada 30 segundos
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of cacheRef.current.entries()) {
        if (now - value.timestamp > CACHE_TTL * 3) { // 3x TTL para cleanup
          cacheRef.current.delete(key);
        }
      }
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Real-time subscriptions para mensagens
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id || !currentConversationId) {
      return;
    }

    console.log('🔌 Criando subscription para conversa:', currentConversationId);

    const channel = supabase
      .channel(`conversation-messages-${currentConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`
        },
        (payload) => {
          const newMessage = payload.new as WhatsAppMessage;
          
          console.log('📨 [INSERT useConversationMessages] Nova mensagem recebida via Realtime:', {
            id: newMessage.id,
            sender_type: newMessage.sender_type,
            workspace_id: newMessage.workspace_id,
            current_workspace: selectedWorkspace.workspace_id,
            conversation_id: newMessage.conversation_id,
            content_preview: newMessage.content?.substring(0, 30)
          });
          
          // ✅ PROCESSAR TODAS as mensagens (contact E agent)
          console.log('✅ [INSERT useConversationMessages] Processando mensagem:', {
            sender_type: newMessage.sender_type,
            is_contact: newMessage.sender_type === 'contact',
            is_agent: newMessage.sender_type === 'agent'
          });
          
          // Verificar se é do workspace atual
          if (newMessage.workspace_id === selectedWorkspace.workspace_id) {
            console.log('✅ [INSERT useConversationMessages] Workspace correto, chamando addMessage...');
            addMessage(newMessage);
          } else {
            console.log('❌ [INSERT useConversationMessages] Workspace diferente, ignorando mensagem');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`
        },
        (payload) => {
          const updatedMessage = payload.new as WhatsAppMessage;
          
          console.log('🔄 [UPDATE] Mensagem atualizada via Realtime:', {
            id: updatedMessage.id,
            sender_type: updatedMessage.sender_type,
            status: updatedMessage.status,
            content_preview: updatedMessage.content?.substring(0, 30)
          });
          
          // Verificar se é do workspace atual
          if (updatedMessage.workspace_id !== selectedWorkspace.workspace_id) {
            console.log('❌ [UPDATE] Workspace diferente, ignorando');
            return;
          }
          
          // ✅ APENAS ATUALIZAR STATUS (sem lógica de substituição)
          console.log('🔄 [UPDATE] Atualizando apenas status da mensagem:', {
            id: updatedMessage.id,
            status: updatedMessage.status
          });
          
          updateMessage(updatedMessage.id, {
            status: updatedMessage.status,
            delivered_at: updatedMessage.delivered_at,
            read_at: updatedMessage.read_at
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Limpando subscription da conversa:', currentConversationId);
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id, currentConversationId, addMessage, updateMessage]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadInitial,
    loadMore,
    addMessage,
    updateMessage,
    removeMessage, // ✅ NOVO
    clearMessages
  };
}