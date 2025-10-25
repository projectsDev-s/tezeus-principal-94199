import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  status?: string;
  delivered_at?: string;
  read_at?: string;
  external_id?: string;
  metadata?: any;
  workspace_id?: string;
  reply_to_message_id?: string;
  quoted_message?: {
    id: string;
    content: string;
    sender_type: 'contact' | 'agent';
    message_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
    file_url?: string;
    file_name?: string;
    external_id?: string;
  };
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
  removeMessage: (messageId: string) => void;
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
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();
  
  // Cache em memória
  const cacheRef = useRef<Map<string, { messages: WhatsAppMessage[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 2000;

  // ✅ ESTABILIZAR headers com useMemo
  const headers = useMemo(() => {
    try {
      return getHeaders();
    } catch (error) {
      console.error('❌ [useConversationMessages] Erro ao gerar headers:', error);
      return {};
    }
  }, [getHeaders]);

  const clearMessages = useCallback(() => {
    console.log('🧹 [useConversationMessages] clearMessages chamado:', {
      timestamp: new Date().toISOString()
    });
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(null);
  }, []);

  const loadInitial = useCallback(async (conversationId: string) => {
    if (!selectedWorkspace?.workspace_id) return;

    console.log('🔄 [useConversationMessages] loadInitial chamado:', {
      conversationId,
      workspaceId: selectedWorkspace.workspace_id,
      timestamp: new Date().toISOString()
    });

    // Invalidar cache
    const cacheKey = `${selectedWorkspace.workspace_id}:${conversationId}`;
    cacheRef.current.delete(cacheKey);

    setLoading(true);
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(conversationId);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: conversationId,
          limit: 6
        },
        headers
      });

      if (error) {
        console.error('❌ [useConversationMessages] Erro ao carregar mensagens:', error);
        toast({
          title: "Erro ao carregar mensagens",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const newMessages = data?.items || [];
      console.log(`✅ [useConversationMessages] Carregadas ${newMessages.length} mensagens para conversa ${conversationId}`);

      setMessages(newMessages);
      setHasMore(!!data?.nextBefore);
      setCursorBefore(data?.nextBefore || null);

      cacheRef.current.set(cacheKey, {
        messages: newMessages,
        timestamp: Date.now()
      });

    } catch (error: any) {
      console.error('❌ [useConversationMessages] Erro ao carregar mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace?.workspace_id]); // ✅ SEM getHeaders e toast

  const loadMore = useCallback(async () => {
    if (!currentConversationId || !cursorBefore) return;

    console.log('🔄 [useConversationMessages] loadMore chamado:', {
      conversationId: currentConversationId,
      cursorBefore,
      timestamp: new Date().toISOString()
    });

    setLoadingMore(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-messages', {
        body: { 
          conversation_id: currentConversationId,
          limit: 6,
          before: cursorBefore
        },
        headers
      });

      if (error) {
        console.error('❌ [useConversationMessages] Erro ao carregar mais mensagens:', error);
        toast({
          title: "Erro ao carregar mensagens",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const olderMessages = data?.items || [];
      console.log(`✅ [useConversationMessages] Carregadas ${olderMessages.length} mensagens adicionais`);

      if (olderMessages.length === 0) {
        setHasMore(false);
        return;
      }

      setMessages(prevMessages => [...olderMessages, ...prevMessages]);
      setHasMore(!!data?.nextBefore);
      setCursorBefore(data?.nextBefore || null);

      if (selectedWorkspace?.workspace_id) {
        const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
        cacheRef.current.set(cacheKey, {
          messages: [...olderMessages, ...messages],
          timestamp: Date.now()
        });
      }

    } catch (error: any) {
      console.error('❌ [useConversationMessages] Erro ao carregar mais mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [currentConversationId, cursorBefore, messages, selectedWorkspace?.workspace_id]); // ✅ SEM getHeaders e toast

  const addMessage = useCallback((message: WhatsAppMessage) => {
    console.log('➕ [useConversationMessages] addMessage chamado:', {
      messageId: message.id,
      conversationId: message.conversation_id,
      timestamp: new Date().toISOString()
    });

    setMessages(prev => {
      const exists = prev.some(m => m.id === message.id);
      if (exists) {
        console.log('⚠️ [useConversationMessages] Mensagem duplicada ignorada:', message.id);
        return prev;
      }
      
      const newMessages = [...prev, message];
      newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return newMessages;
    });
    
    if (selectedWorkspace?.workspace_id && currentConversationId) {
      const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
      cacheRef.current.delete(cacheKey);
    }
  }, [selectedWorkspace?.workspace_id, currentConversationId]);

  const updateMessage = useCallback((messageId: string, updates: Partial<WhatsAppMessage>) => {
    console.log('🔄 [useConversationMessages] updateMessage chamado:', {
      messageId,
      updates,
      timestamp: new Date().toISOString()
    });

    setMessages(prev => {
      const messageIndex = prev.findIndex(m => m.id === messageId || m.external_id === messageId);
      if (messageIndex === -1) {
        console.log('⚠️ [useConversationMessages] Mensagem não encontrada para update:', messageId);
        return prev;
      }

      const newMessages = [...prev];
      const oldMessage = newMessages[messageIndex];
      newMessages[messageIndex] = { ...oldMessage, ...updates };

      if (updates.id && updates.id !== messageId) {
        if (selectedWorkspace?.workspace_id && currentConversationId) {
          const cacheKey = `${selectedWorkspace.workspace_id}:${currentConversationId}`;
          cacheRef.current.delete(cacheKey);
        }
      }

      return newMessages;
    });
  }, [selectedWorkspace?.workspace_id, currentConversationId]);

  const removeMessage = useCallback((messageId: string) => {
    console.log('🗑️ [useConversationMessages] removeMessage chamado:', {
      messageId,
      timestamp: new Date().toISOString()
    });
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // Limpar cache quando workspace muda
  useEffect(() => {
    if (selectedWorkspace?.workspace_id) {
      cacheRef.current.clear();
      console.log('🗑️ Cache limpo devido à mudança de workspace');
    }
  }, [selectedWorkspace?.workspace_id]);

  // Limpar cache antigo periodicamente
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of cacheRef.current.entries()) {
        if (now - value.timestamp > CACHE_TTL * 3) {
          cacheRef.current.delete(key);
        }
      }
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // ✅ SUBSCRIPTION DE MENSAGENS (ÚNICO E CENTRALIZADO)
  useEffect(() => {
    if (!currentConversationId || !selectedWorkspace?.workspace_id) return;

    console.log('🔌 [useConversationMessages] Configurando subscription para:', {
      conversationId: currentConversationId,
      workspaceId: selectedWorkspace.workspace_id,
      timestamp: new Date().toISOString()
    });

    const channel = supabase
      .channel(`messages-${currentConversationId}-${selectedWorkspace.workspace_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`
        },
        (payload) => {
          console.log('📨 [useConversationMessages] Nova mensagem recebida via real-time:', {
            messageId: payload.new.id,
            conversationId: currentConversationId,
            timestamp: new Date().toISOString()
          });
          const newMessage = payload.new as WhatsAppMessage;
          addMessage(newMessage);
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
          console.log('🔄 [useConversationMessages] Mensagem atualizada via real-time:', {
            messageId: payload.new.id,
            conversationId: currentConversationId,
            timestamp: new Date().toISOString()
          });
          const updatedMessage = payload.new as WhatsAppMessage;
          updateMessage(updatedMessage.id, updatedMessage);
        }
      )
      .subscribe((status) => {
        console.log('📡 [useConversationMessages] Status da subscription:', {
          status,
          conversationId: currentConversationId,
          timestamp: new Date().toISOString()
        });
      });

    return () => {
      console.log('🔌 [useConversationMessages] Removendo subscription:', {
        conversationId: currentConversationId,
        timestamp: new Date().toISOString()
      });
      supabase.removeChannel(channel);
    };
  }, [currentConversationId, selectedWorkspace?.workspace_id, addMessage, updateMessage]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadInitial,
    loadMore,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages
  };
}
