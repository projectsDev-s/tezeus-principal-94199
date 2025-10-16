import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';

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
}

export const useWhatsAppConversations = () => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, logout } = useAuth();
  
  // ✅ Rastrear último update processado para evitar duplicatas
  const lastUpdateProcessed = useRef<Map<string, number>>(new Map());
  
  // ✅ DEBOUNCE: Rastrear UPDATEs recentes para evitar processamento duplicado
  const recentUpdates = useRef<Map<string, number>>(new Map());
  
  // ✅ MUTEX: Prevenir envio duplicado de mensagens
  const sendingRef = useRef<Map<string, boolean>>(new Map());

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

      // Use Edge Function with user authentication headers and workspace context
      const headers: Record<string, string> = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      // Add workspace context - OBRIGATÓRIO para todos os usuários
      if (selectedWorkspace?.workspace_id) {
        headers['x-workspace-id'] = selectedWorkspace.workspace_id;
      } else {
        // Workspace not selected - awaiting selection
        return;
      }

      // ✅ CRÍTICO: Use whatsapp-get-conversations-lite (SEM mensagens, COM connection_id)
      const { data: response, error: functionError } = await supabase.functions.invoke(
        'whatsapp-get-conversations-lite', {
        headers
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
        agente_ativo: false,
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
      
      setConversations(formattedConversations);
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
      const { error } = await supabase
        .from('conversations')
        .update({ agente_ativo: false })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: false }
          : conv
      ));

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
      const { error } = await supabase
        .from('conversations')
        .update({ agente_ativo: true })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: true }
          : conv
      ));

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
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (conversationError) {
        console.error('❌ Erro ao atualizar contador da conversa:', conversationError);
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

  // ✅ CORREÇÃO: Subscription única e otimizada para evitar duplicação
  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (!currentUserData?.id || !selectedWorkspace?.workspace_id) {
      return;
    }

    const workspaceId = selectedWorkspace.workspace_id; // ✅ Capturar workspace_id no closure
    console.log('🔌 Iniciando subscription de realtime para workspace:', workspaceId);

    // ✅ GARANTIR SUBSCRIPTION ÚNICA
    const messagesChannel = supabase
      .channel(`whatsapp-messages-${workspaceId}`) // ✅ Canal único por workspace
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMessage = payload.new as any;
          
          console.log('📨 [INSERT useWhatsAppConversations] Nova mensagem recebida:', {
            id: newMessage.id,
            sender_type: newMessage.sender_type,
            workspace_id: newMessage.workspace_id
          });
          
          // ✅ IGNORAR mensagens de agente - elas são tratadas otimisticamente
          if (newMessage.sender_type === 'agent') {
            console.log('⏭️ [INSERT useWhatsAppConversations] IGNORANDO mensagem de agent (otimista)');
            return;
          }
          
          // ✅ Filtrar por workspace_id para garantir que apenas mensagens do workspace atual sejam processadas
          if (newMessage.workspace_id !== workspaceId) {
            console.log('⏭️ [INSERT useWhatsAppConversations] Workspace diferente, ignorando');
            return;
          }
          
          console.log('✅ [INSERT useWhatsAppConversations] Processando mensagem de contact');
          
          // ✅ CORREÇÃO 1: Ignorar mensagens de agent no INSERT (elas vêm via UPDATE)
          if (newMessage.sender_type === 'agent') {
            console.log('⏭️ [INSERT] Ignorando mensagem de agent (será adicionada via UPDATE):', newMessage.id);
            return;
          }
          
          console.log('📨 Realtime: Nova mensagem', {
            id: newMessage.id,
            conversation_id: newMessage.conversation_id,
            sender_type: newMessage.sender_type,
            workspace_id: newMessage.workspace_id
          });
          
          setConversations(prev => {
            const updated = prev.map(conv => {
              if (conv.id === newMessage.conversation_id) {
                // ✅ Verificar se mensagem já existe para evitar duplicatas
                const messageExists = conv.messages.some(msg => msg.id === newMessage.id);
                if (messageExists) {
                  console.log('⚠️ Mensagem duplicada detectada e ignorada:', newMessage.id);
                  return conv;
                }

                // Criar objeto da nova mensagem
                const messageObj = {
                  id: newMessage.id,
                  content: newMessage.content,
                  sender_type: newMessage.sender_type,
                  created_at: newMessage.created_at,
                  read_at: newMessage.read_at,
                  status: newMessage.status,
                  message_type: newMessage.message_type,
                  file_url: newMessage.file_url,
                  file_name: newMessage.file_name,
                  origem_resposta: newMessage.origem_resposta || 'manual',
                };

                // Criar a última mensagem para o card
                const lastMessage = {
                  content: newMessage.content,
                  message_type: newMessage.message_type,
                  sender_type: newMessage.sender_type,
                  created_at: newMessage.created_at
                };

                const updatedConv = {
                  ...conv,
                  messages: [...conv.messages, messageObj],
                  last_message: [lastMessage], // Atualizar last_message
                  last_activity_at: newMessage.created_at
                };

                console.log('✅ Mensagem adicionada:', {
                  conversation_id: conv.id,
                  message_id: newMessage.id,
                  sender_type: newMessage.sender_type,
                  total_messages: updatedConv.messages.length
                });

                return updatedConv;
              }
              return conv;
            });

            // Reordenar por atividade para mover conversas com novas mensagens para o topo
            const sorted = updated.sort((a, b) => 
              new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
            );
            
            return sorted;
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updatedMessage = payload.new as any;
          
          console.log('📨 Message updated via realtime:', payload);
          console.log('✏️ Mensagem atualizada:', {
            id: updatedMessage.id,
            status: updatedMessage.status,
            sender_type: updatedMessage.sender_type,
            conversation_id: updatedMessage.conversation_id,
            message_type: updatedMessage.message_type,
            file_url: updatedMessage.file_url,
            file_name: updatedMessage.file_name,
          });
          
          // ✅ DEBOUNCE: Ignorar UPDATEs duplicados em menos de 1 segundo
          const now = Date.now();
          const lastUpdate = recentUpdates.current.get(updatedMessage.id) || 0;
          
          if (now - lastUpdate < 1000) {
            console.log('⏭️ Ignorando UPDATE duplicado:', updatedMessage.id, `(${now - lastUpdate}ms)`);
            return;
          }
          
          recentUpdates.current.set(updatedMessage.id, now);
          
          // ✅ REFINAMENTO: Só ADICIONAR se for mensagem de agent E não existir
          setConversations(prev => prev.map(conv => {
            if (conv.id === updatedMessage.conversation_id) {
              const existingMsgIndex = conv.messages.findIndex(m => m.id === updatedMessage.id);
              
              // ✅ CASO 1: Mensagem NÃO existe E é de agent → ADICIONAR
              if (existingMsgIndex === -1 && updatedMessage.sender_type === 'agent') {
                console.log('✅ [UPDATE] Adicionando nova mensagem agent:', updatedMessage.id);
                
                const messageObj = {
                  id: updatedMessage.id,
                  content: updatedMessage.content,
                  sender_type: updatedMessage.sender_type,
                  created_at: updatedMessage.created_at,
                  read_at: updatedMessage.read_at,
                  status: updatedMessage.status,
                  message_type: updatedMessage.message_type,
                  file_url: updatedMessage.file_url,
                  file_name: updatedMessage.file_name,
                  origem_resposta: updatedMessage.origem_resposta || 'manual',
                };
                
                return {
                  ...conv,
                  messages: [...conv.messages, messageObj],
                  last_message: [{
                    content: updatedMessage.content,
                    message_type: updatedMessage.message_type,
                    sender_type: updatedMessage.sender_type,
                    created_at: updatedMessage.created_at
                  }],
                  last_activity_at: updatedMessage.created_at
                };
              }
              
              // ✅ CASO 2: Mensagem JÁ existe → ATUALIZAR
              if (existingMsgIndex !== -1) {
                console.log('🔄 [UPDATE] Atualizando mensagem existente:', updatedMessage.id);
                return {
                  ...conv,
                  messages: conv.messages.map(msg => 
                    msg.id === updatedMessage.id 
                      ? {
                          ...msg,
                          status: updatedMessage.status ?? msg.status,
                          read_at: updatedMessage.read_at ?? msg.read_at,
                          message_type: updatedMessage.message_type ?? msg.message_type,
                          file_url: updatedMessage.file_url ?? msg.file_url,
                          file_name: updatedMessage.file_name ?? msg.file_name,
                          content: updatedMessage.content ?? msg.content,
                        }
                      : msg
                  )
                };
              }
              
              // ✅ CASO 3: Mensagem NÃO existe E NÃO é de agent → IGNORAR
              console.log('⏭️ Ignorando UPDATE de contact que não existe:', updatedMessage.id);
            }
            return conv;
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedMessageId = payload.old?.id;
          console.log('🗑️ Mensagem deletada:', deletedMessageId);
          
          if (deletedMessageId) {
            setConversations(prev => prev.map(conv => ({
              ...conv,
              messages: conv.messages.filter(msg => msg.id !== deletedMessageId)
            })));
          }
        }
      )
      .subscribe();

    // ✅ CORREÇÃO: Subscription única para conversas com canal único por workspace
    const conversationsChannel = supabase
      .channel(`wapp-convs-${workspaceId}`) // ✅ Canal único por workspace
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        async (payload) => {
          // Realtime: New conversation received
          const newConv = payload.new as any;
          
          // Só processar conversas do WhatsApp
          if (newConv.canal !== 'whatsapp') return;
          
          // ✅ Filtrar por workspace_id para garantir que apenas conversas do workspace atual sejam processadas
          if (newConv.workspace_id !== workspaceId) {
            // Conversation from different workspace - ignored
            return;
          }
          
          console.log('🔔 Nova conversa criada:', newConv);
          
          // Buscar dados completos da nova conversa
          const { data: conversationData } = await supabase
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
              contacts!inner (
                id,
                name,
                phone,
                email,
                profile_image_url
              )
            `)
            .eq('id', newConv.id)
            .single();

          if (conversationData && conversationData.contacts) {
            const newConversation: WhatsAppConversation = {
              id: conversationData.id,
              contact: {
                id: conversationData.contacts.id,
                name: conversationData.contacts.name,
                phone: conversationData.contacts.phone,
                email: conversationData.contacts.email,
                profile_image_url: conversationData.contacts.profile_image_url,
              },
              agente_ativo: conversationData.agente_ativo,
              status: conversationData.status as 'open' | 'closed' | 'pending',
              unread_count: conversationData.unread_count,
              last_activity_at: conversationData.last_activity_at,
              created_at: conversationData.created_at,
              evolution_instance: (conversationData as any).evolution_instance ?? null,
              messages: [],
            };

            setConversations(prev => {
              const exists = prev.some(conv => conv.id === newConversation.id);
              if (exists) return prev;
              
              return [newConversation, ...prev].sort((a, b) => 
                new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
              );
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          try {
            console.log('🔄 Realtime: Conversa atualizada (REPLICA IDENTITY FULL):', {
              id: payload.new?.id,
              workspace_id: payload.new?.workspace_id,
              unread_count: payload.new?.unread_count,
              status: payload.new?.status,
              agente_ativo: payload.new?.agente_ativo,
              last_activity_at: payload.new?.last_activity_at,
              assigned_user_id: payload.new?.assigned_user_id,
              current_workspace: selectedWorkspace?.workspace_id,
              old_last_activity: payload.old?.last_activity_at,
              new_last_activity: payload.new?.last_activity_at
            });
            
            const updatedConv = payload.new as any;
            const oldConv = payload.old as any;
            
            if (!updatedConv) {
              console.log('⚠️ Payload.new é null - ignorando evento');
              return;
            }
          
          // ✅ Filtrar por workspace_id para garantir que apenas conversas do workspace atual sejam processadas
          if (updatedConv.workspace_id !== workspaceId) {
            // Conversation update from different workspace - ignored
            return;
          }
          
          // ✅ CRÍTICO: Evitar processar updates duplicados em menos de 500ms
          const now = Date.now();
          const lastUpdate = lastUpdateProcessed.current.get(updatedConv.id) || 0;
          
          if (now - lastUpdate < 500) {
            console.log('⚠️ [Realtime] Update duplicado ignorado:', updatedConv.id, `(${now - lastUpdate}ms)`);
            return;
          }
          
          lastUpdateProcessed.current.set(updatedConv.id, now);
          
          setConversations(prev => {
            console.log('🔍 Antes da atualização:', {
              total: prev.length,
              conversation_exists: prev.some(c => c.id === updatedConv.id),
              current_order: prev.slice(0, 3).map(c => ({ 
                id: c.id, 
                unread: c.unread_count, 
                last_activity: c.last_activity_at 
              }))
            });

            // Encontrar a conversa e atualizar
            let conversationFound = false;
            const updated = prev.map(conv => {
              if (conv.id === updatedConv.id) {
                conversationFound = true;
                const updatedConversation = { 
                  ...conv, 
                  agente_ativo: updatedConv.agente_ativo ?? conv.agente_ativo,
                  unread_count: updatedConv.unread_count ?? conv.unread_count,
                  last_activity_at: updatedConv.last_activity_at ?? conv.last_activity_at,
                  status: updatedConv.status ?? conv.status,
                  evolution_instance: updatedConv.evolution_instance ?? conv.evolution_instance,
                  ...(updatedConv.assigned_user_id !== undefined && { assigned_user_id: updatedConv.assigned_user_id }),
                  ...(updatedConv.priority !== undefined && { priority: updatedConv.priority })
                };
                
                console.log('📝 Conversa atualizada:', {
                  id: conv.id,
                  old_last_activity: conv.last_activity_at,
                  new_last_activity: updatedConversation.last_activity_at,
                  old_unread: conv.unread_count,
                  new_unread: updatedConversation.unread_count
                });
                
                return updatedConversation;
              }
              return conv;
            });
            
            if (!conversationFound) {
              console.log('⚠️ Conversa não encontrada na lista atual:', updatedConv.id);
              return prev; // Retorna sem alterações se a conversa não existe
            }
            
            // Reordenar por atividade após atualização - garantir que sempre reordene
            const sorted = [...updated].sort((a, b) => {
              const timeA = new Date(a.last_activity_at).getTime();
              const timeB = new Date(b.last_activity_at).getTime();
              return timeB - timeA; // Mais recente primeiro
            });
            
            console.log('✅ Lista reordenada em tempo real:', {
              total: sorted.length,
              updated_conversation_id: updatedConv.id,
              conversation_moved_to_top: sorted[0]?.id === updatedConv.id,
              new_order: sorted.slice(0, 5).map(c => ({ 
                id: c.id, 
                unread: c.unread_count, 
                last_activity: c.last_activity_at,
                contact_name: c.contact.name
              }))
            });
            
            // Forçar re-render comparando se realmente houve mudança na ordem
            const orderChanged = JSON.stringify(prev.map(c => c.id)) !== JSON.stringify(sorted.map(c => c.id));
            if (orderChanged) {
              console.log('🔄 Ordem das conversas alterada - forçando re-render');
            }
            
            return sorted;
          });
          } catch (error) {
            console.error('❌ Erro no processamento de update em conversation:', error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Real-time subscription active
        }
        // Channel errors handled silently
      });

    // Monitor subscription status
    messagesChannel.subscribe();

    // ✅ CLEANUP: Garantir remoção adequada dos canais
    return () => {
      console.log('🔕 Removendo subscriptions do workspace:', workspaceId);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [selectedWorkspace?.workspace_id]); // ✅ Recriar subscriptions quando workspace muda

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