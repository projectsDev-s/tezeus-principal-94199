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
  sender_type: 'contact' | 'agent' | 'system' | 'ia' | 'user';
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
    sender_type: 'contact' | 'agent' | 'system' | 'ia' | 'user';
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
  loadInitial: (conversationId: string, forceRefresh?: boolean) => Promise<void>;
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
  const CACHE_TTL = 0; // ✅ Desabilitar cache para sempre buscar dados frescos

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

  const loadInitial = useCallback(async (conversationId: string, forceRefresh = false) => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;

    console.log('🔄 [useConversationMessages] loadInitial chamado:', {
      conversationId,
      workspaceId,
      forceRefresh,
      timestamp: new Date().toISOString()
    });

    // Invalidar cache (sempre, principalmente se forceRefresh)
    const cacheKey = `${workspaceId}:${conversationId}`;
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
  }, []); // ✅ ESTÁVEL - lê selectedWorkspace dentro da função

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
      external_id: message.external_id,
      conversationId: message.conversation_id,
      timestamp: new Date().toISOString()
    });

    setMessages(prev => {
      // ✅ Verificar duplicata por ID ou external_id
      const existsById = prev.some(m => m.id === message.id);
      const existsByExternalId = message.external_id && prev.some(m => m.external_id === message.external_id);
      
      if (existsById || existsByExternalId) {
        console.log('⚠️ [useConversationMessages] Mensagem duplicada ignorada:', {
          id: message.id,
          external_id: message.external_id,
          existsById,
          existsByExternalId
        });
        return prev;
      }
      
      const newMessages = [...prev, message];
      newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return newMessages;
    });
    
    const workspaceId = selectedWorkspace?.workspace_id;
    const convId = currentConversationId;
    if (workspaceId && convId) {
      const cacheKey = `${workspaceId}:${convId}`;
      cacheRef.current.delete(cacheKey);
    }
  }, []); // ✅ ESTÁVEL - lê variáveis dentro da função

  const updateMessage = useCallback((messageId: string, updates: Partial<WhatsAppMessage>) => {
    console.log('🔄 [updateMessage] Chamado com:', {
      messageId,
      updates,
      OLD_STATUS: messages.find(m => m.id === messageId || m.external_id === messageId)?.status,
      NEW_STATUS: updates.status,
      delivered_at: updates.delivered_at,
      read_at: updates.read_at,
      timestamp: new Date().toISOString()
    });

    setMessages(prev => {
      const messageIndex = prev.findIndex(m => m.id === messageId || m.external_id === messageId);
      if (messageIndex === -1) {
        console.log('⚠️ [updateMessage] Mensagem não encontrada para update:', {
          messageId,
          totalMessages: prev.length,
          availableIds: prev.map(m => ({ id: m.id, external_id: m.external_id }))
        });
        return prev;
      }

      const newMessages = [...prev];
      const oldMessage = newMessages[messageIndex];
      newMessages[messageIndex] = { ...oldMessage, ...updates };

      console.log('✅ [updateMessage] Mensagem atualizada no estado:', {
        messageId,
        messageIndex,
        oldStatus: oldMessage.status,
        newStatus: newMessages[messageIndex].status,
        oldDelivered: oldMessage.delivered_at,
        newDelivered: newMessages[messageIndex].delivered_at,
        oldRead: oldMessage.read_at,
        newRead: newMessages[messageIndex].read_at
      });

      if (updates.id && updates.id !== messageId) {
        const workspaceId = selectedWorkspace?.workspace_id;
        const convId = currentConversationId;
        if (workspaceId && convId) {
          const cacheKey = `${workspaceId}:${convId}`;
          cacheRef.current.delete(cacheKey);
        }
      }

      return newMessages;
    });
  }, [messages, selectedWorkspace?.workspace_id, currentConversationId]);

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
    if (!currentConversationId || !selectedWorkspace?.workspace_id) {
      console.log('⚠️ [useConversationMessages] Subscription NÃO iniciada - faltam dados:', {
        currentConversationId,
        workspaceId: selectedWorkspace?.workspace_id
      });
      return;
    }

    const channelName = `messages-${currentConversationId}-workspace-${selectedWorkspace.workspace_id}`;
    console.log('🔌 [useConversationMessages] INICIANDO subscription:', {
      channelName,
      conversationId: currentConversationId,
      workspaceId: selectedWorkspace.workspace_id,
      timestamp: new Date().toISOString()
    });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`
        },
        (payload) => {
          console.log('📨 [REALTIME] ✅ NOVA MENSAGEM RECEBIDA:', {
            messageId: payload.new.id,
            external_id: payload.new.external_id,
            content: payload.new.content?.substring(0, 50),
            conversationId: currentConversationId,
            sender_type: payload.new.sender_type,
            timestamp: new Date().toISOString(),
            payload: payload.new
          });
          
          const newMessage = payload.new as WhatsAppMessage;
          
          // ✅ Verificar se existe mensagem otimista com mesmo external_id e substituir
          setMessages(prev => {
            // Buscar mensagem otimista pelo external_id
            const optimisticIndex = newMessage.external_id 
              ? prev.findIndex(m => m.external_id === newMessage.external_id && m.id !== newMessage.id)
              : -1;
            
            if (optimisticIndex !== -1) {
              // ✅ Substituir mensagem otimista pela real
              console.log('🔄 [REALTIME] Substituindo mensagem otimista pela real:', {
                optimisticId: prev[optimisticIndex].id,
                realId: newMessage.id,
                external_id: newMessage.external_id
              });
              
              const newMessages = [...prev];
              newMessages[optimisticIndex] = newMessage;
              
              // Ordenar por data
              newMessages.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              
              return newMessages;
            }
            
            // ✅ Verificar se já existe mensagem com mesmo ID ou external_id
            const existsById = prev.some(m => m.id === newMessage.id);
            const existsByExternalId = newMessage.external_id && prev.some(m => m.external_id === newMessage.external_id);
            
            if (existsById || existsByExternalId) {
              console.log('⚠️ [REALTIME] Mensagem duplicada ignorada:', {
                id: newMessage.id,
                external_id: newMessage.external_id,
                existsById,
                existsByExternalId
              });
              return prev;
            }
            
            // ✅ Se não existe, adicionar normalmente
            const updatedMessages = [...prev, newMessage];
            updatedMessages.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            return updatedMessages;
          });
          
          // Invalidar cache
          const workspaceId = selectedWorkspace?.workspace_id;
          const convId = currentConversationId;
          if (workspaceId && convId) {
            const cacheKey = `${workspaceId}:${convId}`;
            cacheRef.current.delete(cacheKey);
          }
          
          console.log('✅ [REALTIME] Mensagem processada:', newMessage.id);
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
          console.log('🔥🔥🔥 [REALTIME UPDATE] ✅ MENSAGEM ATUALIZADA RECEBIDA:', {
            messageId: payload.new.id,
            external_id: payload.new.external_id,
            conversationId: currentConversationId,
            OLD_STATUS: payload.old?.status,
            NEW_STATUS: payload.new.status,
            delivered_at: payload.new.delivered_at,
            read_at: payload.new.read_at,
            timestamp: new Date().toISOString(),
            fullPayload: payload
          });
          
          const updatedMessage = payload.new as WhatsAppMessage;
          
          console.log('🔥 [REALTIME UPDATE] Chamando updateMessage com:', {
            messageId: updatedMessage.id,
            updates: updatedMessage,
            status: updatedMessage.status
          });
          
          updateMessage(updatedMessage.id, updatedMessage);
          
          console.log('✅ [REALTIME UPDATE] updateMessage() executado para mensagem:', updatedMessage.id);
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] STATUS DA SUBSCRIPTION:', {
          status,
          channelName,
          conversationId: currentConversationId,
          timestamp: new Date().toISOString()
        });
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] SUBSCRIPTION ATIVA E FUNCIONANDO!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] ERRO NO CANAL!');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [REALTIME] TIMEOUT NA SUBSCRIPTION!');
        }
      });

    return () => {
      console.log('🔌 [useConversationMessages] 🔴 REMOVENDO subscription:', {
        channelName,
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
