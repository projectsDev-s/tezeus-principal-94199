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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
        // ✅ SEM FILTRO - Filtrar no cliente
      }, (payload) => {
        const newMessage = payload.new as any;
        
        // ✅ FILTRO NO CLIENTE: Ignorar se não for do workspace correto
        if (newMessage.workspace_id !== workspaceId) {
          console.log('⏭️ [Realtime] Mensagem de outro workspace ignorada:', {
            message_workspace: newMessage.workspace_id,
            current_workspace: workspaceId
          });
          return;
        }
        
        console.log('📨 [INSERT useWhatsAppConversations] Nova mensagem recebida:', {
          id: newMessage.id,
          sender_type: newMessage.sender_type,
          workspace_id: newMessage.workspace_id
        });
        
        // ✅ NÃO ignorar mensagens de agent - processar TODAS
        console.log('✅ [INSERT useWhatsAppConversations] Processando mensagem:', {
          sender_type: newMessage.sender_type,
          is_contact: newMessage.sender_type === 'contact',
          is_agent: newMessage.sender_type === 'agent'
        });
          
          console.log('📨 Realtime: Nova mensagem', {
            id: newMessage.id,
            conversation_id: newMessage.conversation_id,
            sender_type: newMessage.sender_type,
            workspace_id: newMessage.workspace_id,
            read_at: newMessage.read_at // ✅ VERIFICAR se vem null ou não
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

                // ✅ CORREÇÃO: NÃO recalcular unread_count aqui - deixar o backend fazer via trigger
                // O evento UPDATE da tabela conversations virá com o valor correto
                const newMessages = [...conv.messages, messageObj];

                console.log('📨 [INSERT] Nova mensagem adicionada:', {
                  conversa: conv.contact.name,
                  sender_type: newMessage.sender_type,
                  is_contact: newMessage.sender_type === 'contact',
                  read_at: newMessage.read_at,
                  current_unread_count: conv.unread_count,
                  aguardando_update_do_backend: true
                });

                // Não atualizar unread_count localmente - deixar o backend fazer
                // O trigger update_conversation_on_new_message vai calcular e o UPDATE virá via realtime
                const updatedConv = {
                  ...conv,
                  messages: newMessages,
                  unread_count: conv.unread_count, // Manter valor atual, aguardar UPDATE do backend
                  last_message: [lastMessage],
                  last_activity_at: newMessage.created_at,
                  _updated_at: Date.now() // ✅ Força re-render
                };

                console.log('✅ [INSERT] Aguardando UPDATE do backend para unread_count:', {
                  conversation_id: conv.id,
                  contact: conv.contact.name,
                  sender_type: newMessage.sender_type,
                  current_unread: conv.unread_count
                });

                return updatedConv;
              }
              return conv;
            });

            // Reordenar por atividade para mover conversas com novas mensagens para o topo
            const sorted = updated.sort((a, b) => 
              new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
            );
            
            console.log('📊 Estado após INSERT:', {
              total_conversas: sorted.length,
              conversas_com_unread: sorted.filter(c => c.unread_count > 0).length,
              unread_por_conversa: sorted.map(c => ({ 
                nome: c.contact.name, 
                unread: c.unread_count,
                total_msgs: c.messages?.length || 0
              }))
            });
            
            return [...sorted]; // ✅ SEMPRE criar novo array
          });
        }
      )
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
        // ✅ SEM FILTRO - Filtrar no cliente
      }, (payload) => {
        const updatedMessage = payload.new as any;
        
        // ✅ FILTRO NO CLIENTE: Ignorar se não for do workspace correto
        if (updatedMessage.workspace_id !== workspaceId) {
          console.log('⏭️ [Realtime] Update de mensagem de outro workspace ignorado');
          return;
        }
        
        console.log('🔄 [UPDATE messages] Mensagem atualizada via realtime:', {
          id: updatedMessage.id,
          status: updatedMessage.status,
          sender_type: updatedMessage.sender_type
        });
        
        // ✅ ATUALIZAR STATUS E FORÇAR RE-RENDER DO CARD
        setConversations(prev => prev.map(conv => {
          if (conv.id === updatedMessage.conversation_id) {
            // ✅ ATUALIZAR last_message se esta mensagem for a mais recente
            const isLastMessage = conv.messages.length > 0 && 
              conv.messages[conv.messages.length - 1].id === updatedMessage.id;
            
            const updatedConv = {
              ...conv,
              messages: conv.messages.map(msg => 
                msg.id === updatedMessage.id 
                  ? {
                      ...msg,
                      status: updatedMessage.status,
                      read_at: updatedMessage.read_at,
                      delivered_at: updatedMessage.delivered_at
                    }
                  : msg
              ),
              _updated_at: Date.now() // ✅ FORÇAR RE-RENDER
            };
            
            // ✅ Atualizar last_message para refletir no card
            if (isLastMessage && updatedMessage.content) {
              updatedConv.last_message = [{
                content: updatedMessage.content,
                message_type: updatedMessage.message_type,
                sender_type: updatedMessage.sender_type,
                created_at: updatedMessage.created_at
              }];
            }
            
            return updatedConv;
          }
          return conv;
        }));
      })
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations'
        // ✅ SEM FILTRO - Filtrar no cliente
      },
        async (payload) => {
          // Realtime: New conversation received
          const newConv = payload.new as any;
          
          // ✅ FILTRO NO CLIENTE: Ignorar se não for do workspace correto
          if (newConv.workspace_id !== workspaceId) {
            console.log('⏭️ [Realtime] Conversa de outro workspace ignorada:', {
              conversation_workspace: newConv.workspace_id,
              current_workspace: workspaceId
            });
            return;
          }
          
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
                console.log('⚠️ Conversa já existe na lista, ignorando');
                return prev;
              }
              
              const updated = [newConversation, ...prev].sort((a, b) => 
                new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
              );

              console.log('✅ Lista atualizada com nova conversa. Total:', updated.length);

              return updated;
            });
          } else {
            console.error('❌ Dados da conversa ou contato não encontrados');
          }

        }
      )
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations'
        // ✅ SEM FILTRO - Filtrar no cliente
      }, (payload) => {
          try {
            const updatedConv = payload.new as any;
            const oldConv = payload.old as any;
            
            // ✅ FILTRO NO CLIENTE: Ignorar se não for do workspace correto
            if (updatedConv?.workspace_id !== workspaceId) {
              console.log('⏭️ [Realtime] Update de conversa de outro workspace ignorado:', {
                conversation_workspace: updatedConv?.workspace_id,
                current_workspace: workspaceId
              });
              return;
            }
            
            console.log('🔄 Realtime: Conversa atualizada (REPLICA IDENTITY FULL):', {
              id: updatedConv?.id,
              workspace_id: updatedConv?.workspace_id,
              unread_count: updatedConv?.unread_count,
              status: updatedConv?.status,
              agente_ativo: updatedConv?.agente_ativo,
              last_activity_at: updatedConv?.last_activity_at,
              assigned_user_id: updatedConv?.assigned_user_id,
              current_workspace: selectedWorkspace?.workspace_id,
              old_last_activity: oldConv?.last_activity_at,
              new_last_activity: updatedConv?.last_activity_at
            });
            
            if (!updatedConv) {
              console.log('⚠️ Payload.new é null - ignorando evento');
              return;
            }
          
          // ✅ CRÍTICO: Evitar processar updates duplicados
          // Comparar APENAS se for o mesmo timestamp (duplicata real)
          const isDuplicate = oldConv && 
            oldConv.unread_count === updatedConv.unread_count &&
            oldConv.last_activity_at === updatedConv.last_activity_at &&
            oldConv.status === updatedConv.status &&
            oldConv.agente_ativo === updatedConv.agente_ativo &&
            oldConv.assigned_user_id === updatedConv.assigned_user_id;
          
          if (isDuplicate) {
            console.log('⏭️ [Realtime] Update duplicado ignorado:', updatedConv.id);
            return;
          }
          
          console.log('✅ [Realtime] Processando update:', {
            id: updatedConv.id,
            old_unread: oldConv?.unread_count,
            new_unread: updatedConv.unread_count,
            old_last_activity: oldConv?.last_activity_at,
            new_last_activity: updatedConv.last_activity_at
          });
          
          setConversations(prev => {
            // ✅ CRÍTICO: Encontrar e atualizar a conversa
            let conversationFound = false;
            const updated = prev.map(conv => {
              if (conv.id === updatedConv.id) {
                conversationFound = true;
                
                // ✅ CRIAR NOVO OBJETO para forçar re-render
                const updatedConversation = { 
                  ...conv, 
                  agente_ativo: updatedConv.agente_ativo ?? conv.agente_ativo,
                  unread_count: updatedConv.unread_count ?? conv.unread_count,
                  last_activity_at: updatedConv.last_activity_at ?? conv.last_activity_at,
                  status: updatedConv.status ?? conv.status,
                  evolution_instance: updatedConv.evolution_instance ?? conv.evolution_instance,
                  ...(updatedConv.assigned_user_id !== undefined && { assigned_user_id: updatedConv.assigned_user_id }),
                  ...(updatedConv.priority !== undefined && { priority: updatedConv.priority }),
                  _updated_at: Date.now() // ✅ FORÇAR RE-RENDER DO CARD
                };
                
                console.log('✅ [UPDATE conversations] Card atualizado:', {
                  id: conv.id,
                  contact: conv.contact.name,
                  old_unread: conv.unread_count,
                  new_unread: updatedConversation.unread_count,
                  old_last_activity: conv.last_activity_at,
                  new_last_activity: updatedConversation.last_activity_at
                });
                
                return updatedConversation;
              }
              return conv;
            });
            
            if (!conversationFound) {
              console.log('⚠️ Conversa não encontrada:', updatedConv.id);
              return prev;
            }
            
            // ✅ CRÍTICO: SEMPRE criar novo array com spread para forçar detecção de mudança
            const sorted = [...updated].sort((a, b) => {
              const timeA = new Date(a.last_activity_at).getTime();
              const timeB = new Date(b.last_activity_at).getTime();
              return timeB - timeA;
            });
            
            console.log('🔄 [UPDATE conversations] Lista reordenada:', {
              total: sorted.length,
              primeiras_5: sorted.slice(0, 5).map(c => ({
                nome: c.contact.name,
                last_activity: c.last_activity_at,
                _updated_at: c._updated_at
              }))
            });
            
            console.log('🔄 [UPDATE] Array atualizado:', {
              total: sorted.length,
              first_conv: sorted[0]?.contact?.name,
              first_unread: sorted[0]?.unread_count
            });
            
            // ✅ RETORNAR NOVO ARRAY para forçar re-render
            return sorted;
          });
          } catch (error) {
            console.error('❌ Erro no processamento de update em conversation:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 [Realtime Conversations] Status da subscription:', status, 'para workspace:', workspaceId);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime Conversations] Canal conectado com sucesso');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ [Realtime Conversations] Erro na conexão:', status);
          console.warn('⚠️ Realtime falhou - considere implementar polling como fallback');
        }
      });

    // Monitor subscription status
    messagesChannel.subscribe((status) => {
      console.log('🔌 [Realtime Messages] Status da subscription:', status, 'para workspace:', workspaceId);
      if (status === 'SUBSCRIBED') {
        console.log('✅ [Realtime Messages] Canal conectado com sucesso');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('❌ [Realtime Messages] Erro na conexão:', status);
      }
    });

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