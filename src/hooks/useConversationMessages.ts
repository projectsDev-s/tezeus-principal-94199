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
          limit: 5
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
          limit: 50, // ✅ Aumentado de 5 para 50
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
    setMessages(prevMessages => {
      // Verificar duplicação por ID
      if (prevMessages.some(m => m.id === message.id)) {
        console.log('📄 Mensagem já existe com ID:', message.id);
        return prevMessages;
      }
      
      // Verificar duplicação por external_id se existir
      if (message.external_id && prevMessages.some(m => m.external_id === message.external_id)) {
        console.log('📄 Mensagem já existe com external_id:', message.external_id);
        return prevMessages;
      }

      // Se for uma mensagem do real-time com external_id, verificar se há mensagem temporária correspondente
      if (message.external_id && message.sender_type === 'agent') {
        const tempMessageIndex = prevMessages.findIndex(m => 
          m.id.startsWith('temp-') && 
          m.conversation_id === message.conversation_id &&
          m.content === message.content &&
          m.sender_type === message.sender_type &&
          m.message_type === message.message_type
        );
        
        if (tempMessageIndex !== -1) {
          console.log('🔄 Substituindo mensagem temporária pela definitiva:', message.id);
          const updatedMessages = [...prevMessages];
          updatedMessages[tempMessageIndex] = message;
          return updatedMessages;
        }
      }

      console.log('📨 Adicionando nova mensagem:', message.id);
      // Adicionar no final (mensagem mais recente)
      return [...prevMessages, message];
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
          
          // ✅ IGNORAR mensagens de agente no INSERT
          // Elas serão adicionadas via UPDATE quando status = 'sent'
          if (newMessage.sender_type === 'agent') {
            console.log('⏭️ Ignorando INSERT de mensagem agent (será adicionada via UPDATE):', newMessage.id);
            return;
          }
          
          // Verificar se é do workspace atual
          if (newMessage.workspace_id === selectedWorkspace.workspace_id) {
            addMessage(newMessage);
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
          // Para mensagens de agente, sempre tentar ATUALIZAR primeiro (pela mensagem otimista)
          if (updatedMessage.sender_type === 'agent') {
            // Tentar encontrar mensagem temporária pelo external_id
            const hasTempMessage = messages.some(m => 
              m.id.startsWith('temp-') && 
              m.conversation_id === updatedMessage.conversation_id &&
              m.sender_type === 'agent' &&
              m.message_type === updatedMessage.message_type &&
              Math.abs(new Date(m.created_at).getTime() - new Date(updatedMessage.created_at).getTime()) < 5000 // 5 segundos de diferença
            );

            if (hasTempMessage) {
              // Substituir mensagem temporária pela real
              console.log('🔄 Substituindo mensagem otimista pela real:', updatedMessage.id);
              setMessages(prev => {
                // Remover mensagem temporária
                const filtered = prev.filter(m => 
                  !(m.id.startsWith('temp-') && 
                    m.conversation_id === updatedMessage.conversation_id &&
                    m.sender_type === 'agent' &&
                    m.message_type === updatedMessage.message_type &&
                    Math.abs(new Date(m.created_at).getTime() - new Date(updatedMessage.created_at).getTime()) < 5000)
                );
                // Adicionar mensagem real no lugar
                return [...filtered, updatedMessage];
              });
            } else if (updatedMessage.status === 'sent') {
              // Se não há mensagem temporária e status é 'sent', adicionar normalmente
              console.log('✅ Adicionando mensagem agent enviada (sem otimista):', updatedMessage.id);
              addMessage(updatedMessage);
            } else {
              // Caso padrão: apenas atualizar status
              updateMessage(updatedMessage.id, updatedMessage);
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