import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

export interface WhatsAppMessage {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia';
  created_at: string;
  read_at?: string | null;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  file_url?: string;
  file_name?: string;
  origem_resposta: 'automatica' | 'manual';
}

export interface WhatsAppConversation {
  id: string;
  contact: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    profile_image_url?: string;
  };
  agente_ativo: boolean;
  status: 'open' | 'closed' | 'pending' | 'em_atendimento';
  unread_count: number;
  last_activity_at: string;
  created_at: string;
  evolution_instance?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  assigned_at?: string | null;
  connection_id?: string;
  connection?: {
    id: string;
    instance_name: string;
    phone_number?: string;
    status: string;
  };
  workspace_id?: string;
  conversation_tags?: Array<{
    id: string;
    tag_id: string;
    tags: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  last_message?: Array<{
    content: string;
    message_type: string;
    sender_type: string;
    created_at: string;
  }>;
  messages: WhatsAppMessage[];
  _updated_at?: number; // ✅ Timestamp para forçar re-render
}

export const useWhatsAppConversations = () => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, logout } = useAuth();
  const { getHeaders } = useWorkspaceHeaders();
  
  // ✅ Rastrear último update processado para evitar duplicatas
  const lastUpdateProcessed = useRef<Map<string, number>>(new Map());
  
  // ✅ DEBOUNCE: Rastrear UPDATEs recentes para evitar processamento duplicado
  const recentUpdates = useRef<Map<string, number>>(new Map());
  
  // ✅ MUTEX: Prevenir envio duplicado de mensagens
  const sendingRef = useRef<Map<string, boolean>>(new Map());
  
  // ✅ CORREÇÃO 2: Usar useRef para currentUserData para estabilizar subscription
  const currentUserDataRef = useRef<{ id: string; email?: string; profile?: string } | null>(null);
  
  // ✅ SINCRONIZAR currentUserDataRef com localStorage usando polling
  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    currentUserDataRef.current = userData ? JSON.parse(userData) : null;

    console.log('🔄 [useWhatsAppConversations] Iniciando polling de sincronização do usuário');

    const interval = setInterval(() => {
      const userData = localStorage.getItem('currentUser');
      const newUserData = userData ? JSON.parse(userData) : null;
      
      if (newUserData?.id !== currentUserDataRef.current?.id) {
        console.log('🔄 [useWhatsAppConversations] User data mudou, sincronizando...', {
          oldUserId: currentUserDataRef.current?.id,
          newUserId: newUserData?.id,
          timestamp: new Date().toISOString()
        });
        currentUserDataRef.current = newUserData;
        fetchConversations();
      }
    }, 1000);
    
    return () => {
      console.log('🛑 [useWhatsAppConversations] Parando polling de sincronização');
      clearInterval(interval);
    };
  }, [selectedWorkspace?.workspace_id]);

  const fetchConversations = async () => {
    const DEBUG_CONVERSATIONS = true; // Ativado para debug
    
    try {
      setLoading(true);
      // Loading WhatsApp conversations

      // Get current user from localStorage (custom auth system)
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (DEBUG_CONVERSATIONS) {
        // User authenticated - workspace selected
      }
      
      if (!currentUserData?.id) {
        console.log('No user data in localStorage');
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      // Use Edge Function with workspace headers from URL
      const headers = getHeaders();

      // ✅ CRÍTICO: Use whatsapp-get-conversations-lite (SEM mensagens, COM connection_id)
      const { data: response, error: functionError } = await supabase.functions.invoke(
        'whatsapp-get-conversations-lite', {
        headers
      });

      console.log('📦 [useWhatsAppConversations] Resposta da Edge Function:', {
        hasData: !!response,
        conversationsCount: response?.items?.length,
        error: functionError
      });

      if (functionError) {
        throw functionError;
      }

      // ✅ Conversas SEM mensagens (dados agora garantidos pela Edge Function)
      const conversationsOnly = response.items || [];
      
      // ✅ Mapear para formato compatível (connection_id e connection já vêm da Edge Function)
      const formattedConversations = conversationsOnly.map(conv => ({
        id: conv.id,
        contact: {
          id: conv.contacts.id,
          name: conv.contacts.name,
          phone: conv.contacts.phone,
          profile_image_url: conv.contacts.profile_image_url
        },
        agente_ativo: conv.agente_ativo || false, // ✅ CORRIGIDO: Ler do banco ao invés de hardcode
        status: conv.status,
        unread_count: conv.unread_count || 0,
        last_activity_at: conv.last_activity_at,
        created_at: conv.created_at || conv.last_activity_at,
        assigned_user_id: conv.assigned_user_id,
        assigned_user_name: conv.assigned_user_name,
        priority: conv.priority,
        last_message: conv.last_message,
        conversation_tags: conv.conversation_tags || [],
        connection_id: conv.connection_id, // ✅ Direto da Edge Function
        connection: conv.connection,       // ✅ Garantido pela Edge Function
        workspace_id: conv.workspace_id,
        messages: []
      }));
      
      console.log('🤖 Conversas carregadas com status de agente:', 
        formattedConversations.map(c => ({ 
          contact: c.contact.name, 
          agente_ativo: c.agente_ativo 
        }))
      );
      
      // ✅ FILTRO CLIENT-SIDE: Se usuário é "user", filtrar apenas conversas atribuídas ou não atribuídas
      let filteredConversations = formattedConversations;
      
      if (currentUserData.profile === 'user') {
        filteredConversations = formattedConversations.filter(conv => 
          conv.assigned_user_id === currentUserData.id || 
          conv.assigned_user_id === null
        );
        console.log('🔒 [Filter] Conversas filtradas para user:', {
          total: formattedConversations.length,
          filtradas: filteredConversations.length,
          criterio: 'assigned_user_id = ' + currentUserData.id + ' OR NULL'
        });
      } else {
        console.log('👑 [Filter] Admin/Master vê todas as conversas:', formattedConversations.length);
      }
      
      setConversations(filteredConversations);
      if (DEBUG_CONVERSATIONS) {
        // Conversations loaded
        
        if (formattedConversations.length === 0) {
          console.log('ℹ️ Nenhuma conversa encontrada. Verifique se há conexões configuradas e conversas ativas.');
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar conversas:', error);
      console.error('Error details:', error.message, error.details);
      
      // If it's a fetch error, provide more specific guidance
      if (error.name === 'FunctionsFetchError') {
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Verifique sua conexão.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: `Erro ao carregar conversas do WhatsApp: ${error.message}`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Accept conversation function - DEPRECATED: Use useConversationAccept hook instead
  // This is kept for backward compatibility but should not be used
  const acceptConversation = useCallback(async (conversationId: string) => {
    console.warn('⚠️ Using deprecated acceptConversation from useWhatsAppConversations. Use useConversationAccept hook instead.');
    
    try {
      // Get current user from localStorage (custom auth system)
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: currentUserData.id })
        .eq('id', conversationId);

      if (error) {
        console.error('Error accepting conversation:', error);
        toast({
          title: "Erro",
          description: "Erro ao aceitar conversa",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conversa aceita",
        description: "Você aceitou esta conversa",
      });
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { 
                ...conv, 
                assigned_user_id: currentUserData.id,
                assigned_user_name: currentUserData.name || null 
              }
            : conv
        )
      );
    } catch (error) {
      console.error('Error in acceptConversation:', error);
      toast({
        title: "Erro",
        description: "Erro ao aceitar conversa",
        variant: "destructive",
      });
    }
  }, []);

  // Função utilitária para obter tipo de arquivo
  const getFileType = (fileName: string): string => {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'image/jpeg';
      case 'mp4':
      case 'mov':
      case 'avi':
        return 'video/mp4';
      case 'mp3':
      case 'wav':
      case 'ogg':
        return 'audio/mpeg';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  };

  // Enviar mensagem
  const sendMessage = useCallback(async (
    conversationId: string, 
    content: string, 
    contactPhone: string, 
    messageType: string = 'text', 
    fileUrl?: string, 
    fileName?: string
  ) => {
    // ✅ MUTEX: Prevenir duplo envio
    if (sendingRef.current.get(conversationId)) {
      console.log('⚠️ Mensagem já sendo enviada, ignorando...');
      return;
    }
    
    sendingRef.current.set(conversationId, true);
    
    try {
      // Obter dados do usuário logado
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se há workspace selecionado
      let workspaceId = selectedWorkspace?.workspace_id;
      
      if (!workspaceId) {
        console.warn('⚠️ Nenhum workspace selecionado');
        return;
      }

      // ✅ GERAR clientMessageId ÚNICO
      const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('📤 Enviando mensagem com clientMessageId:', clientMessageId);

      // Montar payload com clientMessageId
      const payload = {
        conversation_id: conversationId,
        content: content,
        message_type: messageType,
        sender_id: currentUserData.id,
        sender_type: "agent",
        file_url: fileUrl,
        file_name: fileName,
        clientMessageId // ✅ ENVIAR clientMessageId
      };

      const headers: Record<string, string> = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      // Add workspace context if available
      if (selectedWorkspace?.workspace_id) {
        headers['x-workspace-id'] = selectedWorkspace.workspace_id;
      }

      console.log('🚀 Chamando test-send-msg com payload:', payload);
      const { data: sendResult, error: apiError } = await supabase.functions.invoke('test-send-msg', {
        body: payload,
        headers
      });

      if (apiError) {
        console.error('Erro ao enviar via edge function:', apiError);
        const errorMessage = apiError.message || 'Erro ao enviar mensagem';
        throw new Error(errorMessage);
      }

      if (!sendResult?.success) {
        console.error('Envio falhou:', sendResult);
        const errorMessage = sendResult?.message || sendResult?.error || 'Falha no envio da mensagem';
        throw new Error(errorMessage);
      }

      console.log('✅ Mensagem enviada com sucesso, aguardando webhook/realtime');
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      // ✅ SEMPRE limpar mutex
      sendingRef.current.set(conversationId, false);
    }
  }, [selectedWorkspace, toast]);

  // Assumir atendimento (desativar IA)
  const assumirAtendimento = useCallback(async (conversationId: string) => {
    try {
      console.log('🚫 Desativando IA para conversa:', conversationId);
      
      const { error } = await supabase
        .from('conversations')
        .update({ agente_ativo: false })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: false, _updated_at: Date.now() }
          : conv
      ));

      console.log('✅ IA desativada com sucesso');

      toast({
        title: "Atendimento assumido",
        description: "Você assumiu o atendimento desta conversa",
      });
    } catch (error) {
      console.error('❌ Erro ao assumir atendimento:', error);
      toast({
        title: "Erro",
        description: "Erro ao assumir atendimento",
        variant: "destructive",
      });
    }
  }, []);

  // Reativar IA
  const reativarIA = useCallback(async (conversationId: string) => {
    try {
      console.log('🤖 Ativando IA para conversa:', conversationId);
      
      const { error } = await supabase
        .from('conversations')
        .update({ agente_ativo: true })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: true, _updated_at: Date.now() }
          : conv
      ));

      console.log('✅ IA ativada com sucesso');

      toast({
        title: "IA reativada",
        description: "A IA voltou a responder automaticamente nesta conversa",
      });
    } catch (error) {
      console.error('❌ Erro ao reativar IA:', error);
      toast({
        title: "Erro",
        description: "Erro ao reativar IA",
        variant: "destructive",
      });
    }
  }, []);

  // Marcar como lida
  const markAsRead = useCallback(async (conversationId: string) => {
    const DEBUG_CONVERSATIONS = false; // Logs condicionais
    try {
      if (DEBUG_CONVERSATIONS) {
        console.log('📖 Marcando conversa como lida:', conversationId);
      }
      
      // Get current user data
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      // Marcar todas as mensagens do contato como lidas
      const { error: messagesError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .is('read_at', null);

      if (messagesError) {
        console.error('❌ Erro ao marcar mensagens como lidas:', messagesError);
      }

      // Atualizar contador de não lidas na conversa
      console.log('🔄 Zerando unread_count no backend para:', conversationId);
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (conversationError) {
        console.error('❌ Erro ao atualizar contador da conversa:', conversationError);
      } else {
        console.log('✅ unread_count zerado no backend com sucesso');
      }

      // ✅ CORREÇÃO 7: Atualizar estado local imediatamente
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { 
              ...conv, 
              unread_count: 0,
              messages: conv.messages.map(msg => 
                msg.sender_type === 'contact' 
                  ? { ...msg, read_at: new Date().toISOString() }
                  : msg
              )
            }
          : conv
      ));

      if (DEBUG_CONVERSATIONS) {
        // Conversation marked as read
      }
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  }, [selectedWorkspace]);

  // Limpar todas as conversas
  const clearAllConversations = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('clear-conversations');
      
      if (error) throw error;
      
      setConversations([]);
      toast({
        title: "Conversas limpas",
        description: "Todas as conversas foram removidas",
      });
    } catch (error) {
      console.error('❌ Erro ao limpar conversas:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar conversas",
        variant: "destructive",
      });
    }
  }, []);

  // Real-time subscriptions and workspace dependency
  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (currentUserData?.id && selectedWorkspace?.workspace_id) {
      const DEBUG_CONVERSATIONS = false;
      if (DEBUG_CONVERSATIONS) {
        // Workspace changed - reloading conversations
      }
      
      // Forçar limpeza completa das conversas quando workspace muda
      setConversations([]);
      setLoading(true);
      
      // Aguardar um pouco para garantir que o estado foi limpo antes de recarregar
      setTimeout(() => {
        fetchConversations();
      }, 200);
    } else if (currentUserData?.id && !selectedWorkspace?.workspace_id) {
      // Awaiting workspace selection
      setLoading(true);
    }
  }, [selectedWorkspace?.workspace_id]); // Re-fetch when workspace changes

  // ✅ SUBSCRIPTION ÚNICA E SIMPLIFICADA
  useEffect(() => {
    const currentUserData = currentUserDataRef.current;
    
    if (!currentUserData?.id || !selectedWorkspace?.workspace_id) {
      return;
    }

    const workspaceId = selectedWorkspace.workspace_id;
    
    console.log('🔌 [useWhatsAppConversations] Configurando subscriptions para workspace:', workspaceId);

    const conversationsChannel = supabase
      .channel(`conversations-${workspaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `workspace_id=eq.${workspaceId}`
      },
        async (payload) => {
          console.log('📨 [useWhatsAppConversations] Nova conversa via real-time:', {
            conversationId: payload.new.id,
            timestamp: new Date().toISOString()
          });
          const newConv = payload.new as any;
          
          // Só processar conversas do WhatsApp
          if (newConv.canal !== 'whatsapp') {
            console.log('⏭️ [Realtime] Conversa não-WhatsApp ignorada:', newConv.canal);
            return;
          }
          
          console.log('🔔 Nova conversa criada:', newConv);
          
          // Buscar dados completos da nova conversa
          const { data: conversationData, error: convError } = await supabase
            .from('conversations')
            .select(`
              id,
              agente_ativo,
              status,
              unread_count,
              last_activity_at,
              created_at,
              evolution_instance,
              contact_id,
              workspace_id,
              connection_id,
              assigned_user_id,
              contacts!conversations_contact_id_fkey (
                id,
                name,
                phone,
                email,
                profile_image_url
              )
            `)
            .eq('id', newConv.id)
            .eq('workspace_id', workspaceId)
            .single();

          if (convError) {
            console.error('❌ Erro ao buscar dados da conversa:', convError);
            return;
          }

          console.log('✅ Dados da nova conversa recebidos:', conversationData);

          if (conversationData && conversationData.contacts && Array.isArray(conversationData.contacts) && conversationData.contacts.length > 0) {
            const contact = conversationData.contacts[0];
            const newConversation: WhatsAppConversation = {
              id: conversationData.id,
              contact: {
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                profile_image_url: contact.profile_image_url,
              },
              agente_ativo: conversationData.agente_ativo,
              status: conversationData.status as 'open' | 'closed' | 'pending',
              unread_count: conversationData.unread_count || 0,
              last_activity_at: conversationData.last_activity_at,
              created_at: conversationData.created_at,
              evolution_instance: (conversationData as any).evolution_instance ?? null,
              connection_id: (conversationData as any).connection_id ?? null,
              assigned_user_id: (conversationData as any).assigned_user_id ?? null,
              messages: [],
              last_message: [],
            };

            console.log('➕ Adicionando nova conversa à lista:', {
              id: newConversation.id,
              contact: newConversation.contact.name,
              phone: newConversation.contact.phone
            });

            setConversations(prev => {
              const exists = prev.some(conv => conv.id === newConversation.id);
              if (exists) {
                console.log('⚠️ [useWhatsAppConversations] Conversa duplicada ignorada:', newConversation.id);
                return prev;
              }
              
              return [newConversation, ...prev];
            });
          } else {
            console.error('❌ Dados da conversa ou contato não encontrados');
          }

        }
      )
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `workspace_id=eq.${workspaceId}`
      }, (payload) => {
          console.log('🔄 [useWhatsAppConversations] Conversa atualizada via real-time:', {
            conversationId: payload.new.id,
            status: payload.new.status,
            timestamp: new Date().toISOString()
          });

          const updatedConversation = payload.new as any;

          setConversations(prev => {
            const conversationExists = prev.some(c => c.id === updatedConversation.id);

            const shouldKeepConversation = (() => {
              if (!currentUserDataRef.current) return false;

              if (updatedConversation.status === 'pending') return true;

              if (updatedConversation.status === 'active') {
                return updatedConversation.assigned_user_id === currentUserDataRef.current.id;
              }

              if (updatedConversation.status === 'closed') return false;

              return conversationExists;
            })();

            if (!shouldKeepConversation) {
              console.log('🗑️ [useWhatsAppConversations] Removendo conversa da lista:', updatedConversation.id);
              return prev.filter(c => c.id !== updatedConversation.id);
            }

            const newConversations = conversationExists
              ? prev.map(c => c.id === updatedConversation.id ? updatedConversation : c)
              : [updatedConversation, ...prev];

            return newConversations.sort((a, b) => 
              new Date(b.last_activity_at || b.updated_at).getTime() - 
              new Date(a.last_activity_at || a.updated_at).getTime()
            );
          });
        }
      )
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `workspace_id=eq.${workspaceId}`
      }, (payload) => {
          console.log('📨 [useWhatsAppConversations] Nova notificação via real-time:', {
            notificationId: payload.new.id,
            conversationId: payload.new.conversation_id,
            timestamp: new Date().toISOString()
          });

          const newNotification = payload.new as any;

          if (!newNotification.is_read) {
            setConversations(prev => prev.map(conv => {
              if (conv.id === newNotification.conversation_id) {
                return {
                  ...conv,
                  unread_count: (conv.unread_count || 0) + 1
                };
              }
              return conv;
            }));
          }
        }
      )
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `workspace_id=eq.${workspaceId}`
      }, (payload) => {
          console.log('🔄 [useWhatsAppConversations] Notificação atualizada via real-time:', {
            notificationId: payload.new.id,
            conversationId: payload.new.conversation_id,
            isRead: payload.new.is_read,
            timestamp: new Date().toISOString()
          });

          const updatedNotification = payload.new as any;

          if (updatedNotification.is_read) {
            setConversations(prev => prev.map(conv => {
              if (conv.id === updatedNotification.conversation_id) {
                return {
                  ...conv,
                  unread_count: Math.max(0, (conv.unread_count || 0) - 1)
                };
              }
              return conv;
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [useWhatsAppConversations] Status da subscription:', {
          status,
          workspaceId,
          timestamp: new Date().toISOString()
        });
      });

    return () => {
      console.log('🔌 [useWhatsAppConversations] Removendo subscription do workspace:', workspaceId);
      supabase.removeChannel(conversationsChannel);
    };
  }, [selectedWorkspace?.workspace_id]);

  return {
    conversations,
    loading,
    sendMessage,
    markAsRead,
    assumirAtendimento,
    reativarIA,
    clearAllConversations,
    fetchConversations,
    acceptConversation
  };
};