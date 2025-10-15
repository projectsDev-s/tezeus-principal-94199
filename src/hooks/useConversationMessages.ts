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
      evolution_key_id: (message as any).evolution_key_id,
      evolution_short_key_id: (message as any).evolution_short_key_id,
      external_id: message.external_id
    });
    
    // ✅ DEDUP: Usar conversation_id + message_id como chave única
    const dedupKey = `${message.conversation_id}_${message.id}`;
    
    if (seenRef.current.has(dedupKey)) {
      console.log(`⏭️ Mensagem duplicada ignorada (conversation+id): ${dedupKey}`);
      return;
    }
    
    seenRef.current.add(dedupKey);
    
    // Limpar Set após 30s para liberar memória
    setTimeout(() => seenRef.current.delete(dedupKey), 30000);
    
    setMessages(prevMessages => {
      // Verificar se já existe apenas por ID (mais simples e confiável)
      const exists = prevMessages.some(m => m.id === message.id);
      
      if (exists) {
        console.log(`⚠️ [addMessage] Mensagem já existe no state: ${message.id}`);
        return prevMessages;
      }

      console.log('✅ [addMessage] Mensagem nova, adicionando ao state:', {
        id: message.id,
        sender_type: message.sender_type,
        content_preview: message.content?.substring(0, 30),
        total_messages_after: prevMessages.length + 1
      });
      
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

  const updateMessage = useCallback((messageId: string, updates: Partial<WhatsAppMessage>) => {
    setMessages(prevMessages => {
      const messageIndex = prevMessages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        return prevMessages;
      }

      const updatedMessages = [...prevMessages];
      const currentMessage = updatedMessages[messageIndex];
      const updatedMessage = { ...currentMessage, ...updates };
      
      // Se está mudando o ID (de temporário para real), verificar se já existe mensagem com o novo ID
      if (updates.id && updates.id !== messageId) {
        const existingMessageWithNewId = prevMessages.find(m => m.id === updates.id);
        if (existingMessageWithNewId) {
          // Já existe mensagem com o novo ID, remover a temporária
          console.log('✏️ Removendo mensagem temporária, já existe com ID real:', updates.id);
          return prevMessages.filter(m => m.id !== messageId);
        }
      }
      
      updatedMessages[messageIndex] = updatedMessage;
      console.log('✏️ Mensagem atualizada:', { 
        id: updatedMessage.id, 
        status: updatedMessage.status,
        message_type: updatedMessage.message_type,
        file_url: updatedMessage.file_url,
        file_name: updatedMessage.file_name
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

    // Setting up real-time subscription for conversation

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
          
          console.log('📨 [INSERT] Nova mensagem recebida via Realtime:', {
            id: newMessage.id,
            sender_type: newMessage.sender_type,
            workspace_id: newMessage.workspace_id,
            current_workspace: selectedWorkspace.workspace_id,
            conversation_id: newMessage.conversation_id,
            content_preview: newMessage.content?.substring(0, 30)
          });
          
          // ✅ IGNORAR mensagens de agente no INSERT
          // Elas serão adicionadas via UPDATE quando status = 'sent'
          if (newMessage.sender_type === 'agent') {
            console.log('⏭️ [INSERT] Ignorando mensagem de agent (será adicionada via UPDATE)');
            return;
          }
          
          // Verificar se é do workspace atual
          if (newMessage.workspace_id === selectedWorkspace.workspace_id) {
            console.log('✅ [INSERT] Workspace correto, chamando addMessage...');
            addMessage(newMessage);
          } else {
            console.log('❌ [INSERT] Workspace diferente, ignorando mensagem');
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
          
          // Verificar se é do workspace atual
          if (updatedMessage.workspace_id === selectedWorkspace.workspace_id) {
          // Para mensagens de agente, evitar duplicação
          if (updatedMessage.sender_type === 'agent') {
            // Verificar se mensagem JÁ existe no state
            const existingIndex = messages.findIndex(m => m.id === updatedMessage.id);
            
            if (existingIndex !== -1) {
              // ✅ Mensagem existe → APENAS ATUALIZAR
              console.log(`🔄 Atualizando mensagem agent existente: ${updatedMessage.id}`);
              setMessages(prev => {
                const updated = [...prev];
                updated[existingIndex] = updatedMessage;
                return updated;
              });
            } else if (updatedMessage.status === 'sent') {
              // ✅ Mensagem NÃO existe E status=sent → ADICIONAR UMA VEZ
              console.log(`✅ Adicionando nova mensagem agent: ${updatedMessage.id}`);
              addMessage(updatedMessage);
            } else {
              // ⏭️ Ignorar outros casos (status=sending, etc)
              console.log(`⏭️ Ignorando UPDATE de mensagem agent: ${updatedMessage.id} (status: ${updatedMessage.status})`);
            }
          } else {
            // Para mensagens de contato, apenas atualizar
            updateMessage(updatedMessage.id, updatedMessage);
          }
          }
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
    clearMessages
  };
}