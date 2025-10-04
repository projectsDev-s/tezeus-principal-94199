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
  const CACHE_TTL = 10000; // 10 segundos

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(null);
  }, []);

  const loadInitial = useCallback(async (conversationId: string) => {
    console.log('🔄 loadInitial chamado para conversationId:', conversationId);
    // Loading initial conversation messages
    
    if (!selectedWorkspace?.workspace_id) {
      console.error('❌ Nenhum workspace selecionado!');
      return;
    }

    // Verificar cache
    const cacheKey = `${selectedWorkspace.workspace_id}:${conversationId}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📋 Usando cache, mensagens:', cached.messages.length);
      setMessages(cached.messages);
      setCurrentConversationId(conversationId);
      // Assumir que pode ter mais se tiver 5 ou mais mensagens
      setHasMore(cached.messages.length >= 5);
      if (cached.messages.length > 0) {
        const firstMessage = cached.messages[0];
        setCursorBefore(`${firstMessage.created_at}|${firstMessage.id}`);
      }
      return;
    }

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
      return;
    }

    setLoadingMore(true);

    try {
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: currentConversationId,
          limit: 5,
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
      
      if (newMessages.length === 0) {
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
  }, [selectedWorkspace?.workspace_id, currentConversationId, cursorBefore, loadingMore, hasMore, messages, toast]);

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

  // Effect para limpar cache e recarregar mensagens quando workspace muda
  useEffect(() => {
    if (currentConversationId) {
      // Workspace changed - reloading conversation
      // Limpar todo o cache
      cacheRef.current.clear();
      // Limpar mensagens atuais
      setMessages([]);
      setHasMore(true);
      setCursorBefore(null);
      // Recarregar mensagens da conversa atual
      loadInitial(currentConversationId);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId, loadInitial]);

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

    console.log('🔔 Configurando real-time subscription para conversa:', currentConversationId);

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
          console.log('📩 Nova mensagem recebida via real-time:', payload.new);
          const newMessage = payload.new as WhatsAppMessage;
          
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
          console.log('🔄 Mensagem atualizada via real-time:', payload.new);
          const updatedMessage = payload.new as WhatsAppMessage;
          
          // Verificar se é do workspace atual
          if (updatedMessage.workspace_id === selectedWorkspace.workspace_id) {
            console.log('📊 Status da mensagem atualizado:', {
              id: updatedMessage.id,
              status: updatedMessage.status,
              external_id: updatedMessage.external_id
            });
            updateMessage(updatedMessage.id, updatedMessage);
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