import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

export interface WhatsAppMessage {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia' | 'system' | 'user';
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
  agent_active_id?: string | null;
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
  
  console.log('🎯🎯🎯 [useWhatsAppConversations] Hook EXECUTADO/RENDERIZADO:', {
    hasSelectedWorkspace: !!selectedWorkspace,
    workspaceId: selectedWorkspace?.workspace_id,
    conversationsCount: conversations.length,
    timestamp: new Date().toISOString()
  });
  
  // Refs simples
  const sendingRef = useRef<Map<string, boolean>>(new Map());

  const fetchConversations = async (): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('🔄 Carregando conversas...');

      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;

      if (!currentUserData?.id || !selectedWorkspace?.workspace_id) {
        console.log('❌ Dados ausentes');
        setLoading(false);
        return false;
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-get-conversations-lite', {
        body: { workspace_id: selectedWorkspace.workspace_id },
        headers: getHeaders()
      });

      if (error) throw error;

      if (data?.items) {
        console.log(`✅ ${data.items.length} conversas carregadas`);
        
        // ✅ Se retornou 0 conversas, tenta novamente após 1 segundo
        if (data.items.length === 0) {
          console.log('⏳ Nenhuma conversa retornada, tentando novamente em 1s...');
          setLoading(false);
          
          // Retry após 1 segundo
          setTimeout(async () => {
            console.log('🔄 Retry: Carregando conversas novamente...');
            setLoading(true);
            
            const { data: retryData, error: retryError } = await supabase.functions.invoke('whatsapp-get-conversations-lite', {
              body: { workspace_id: selectedWorkspace.workspace_id },
              headers: getHeaders()
            });
            
            if (!retryError && retryData?.items) {
              console.log(`✅ Retry: ${retryData.items.length} conversas carregadas`);
              
              const transformedConversations = retryData.items.map((item: any) => ({
                id: item.id,
                contact: {
                  id: item.contacts.id,
                  name: item.contacts.name,
                  phone: item.contacts.phone,
                  email: item.contacts.email || null,
                  profile_image_url: item.contacts.profile_image_url
                },
                agente_ativo: item.agente_ativo,
                agent_active_id: item.agent_active_id || null,
                status: item.status,
                unread_count: item.unread_count,
                last_activity_at: item.last_activity_at,
                created_at: item.created_at || item.last_activity_at,
                assigned_user_id: item.assigned_user_id,
                assigned_user_name: item.assigned_user_name,
                connection_id: item.connection_id,
                connection: item.connection,
                workspace_id: selectedWorkspace.workspace_id,
                conversation_tags: item.conversation_tags || [],
                last_message: item.last_message || [],
                messages: []
              }));
              
              setConversations(transformedConversations);
            }
            setLoading(false);
          }, 1000);
          
          return false;
        }
        
        // Transformar items para o formato esperado
        const transformedConversations = data.items.map((item: any) => ({
          id: item.id,
          contact: {
            id: item.contacts.id,
            name: item.contacts.name,
            phone: item.contacts.phone,
            email: item.contacts.email || null,
            profile_image_url: item.contacts.profile_image_url
          },
          agente_ativo: item.agente_ativo,
          agent_active_id: item.agent_active_id || null,
          status: item.status,
          unread_count: item.unread_count,
          last_activity_at: item.last_activity_at,
          created_at: item.created_at || item.last_activity_at,
          assigned_user_id: item.assigned_user_id,
          assigned_user_name: item.assigned_user_name,
          connection_id: item.connection_id,
          connection: item.connection,
          workspace_id: selectedWorkspace.workspace_id,
          conversation_tags: item.conversation_tags || [],
          last_message: item.last_message || [],
          messages: []
        }));
        
        setConversations(transformedConversations);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch (error: any) {
      console.error('❌ Erro:', error);
      setLoading(false);
      return false;
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
        .update({ 
          agente_ativo: false,
          agent_active_id: null  // ✅ LIMPAR ID DO AGENTE
        })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: false, agent_active_id: null, _updated_at: Date.now() }
          : conv
      ));

      console.log('✅ IA desativada com sucesso');

      toast({
        title: "Agente Desativado",
        description: "O agente não irá mais interagir nessa conversa",
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
      
      // Buscar conversa para obter agent_active_id ou queue_id
      const { data: conversation } = await supabase
        .from('conversations')
        .select('agent_active_id, queue_id')
        .eq('id', conversationId)
        .single();
      
      let agentIdToActivate = conversation?.agent_active_id || null;
      
      // Se não tem agent_active_id mas tem queue_id, buscar da fila
      if (!agentIdToActivate && conversation?.queue_id) {
        const { data: queue } = await supabase
          .from('queues')
          .select('ai_agent_id')
          .eq('id', conversation.queue_id)
          .single();
        
        agentIdToActivate = queue?.ai_agent_id || null;
      }
      
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: true,
          agent_active_id: agentIdToActivate  // ✅ RESTAURAR ID DO AGENTE
        })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: true, agent_active_id: agentIdToActivate, _updated_at: Date.now() }
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

  // ✅ CORREÇÃO: Flag de sucesso separada da flag de tentativa
  // Carregar conversas quando workspace muda
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      setLoading(false);
      return;
    }

    console.log('🔄 Workspace mudou, carregando conversas');
    fetchConversations();
  }, [selectedWorkspace?.workspace_id]);

  // ===== REALTIME SUBSCRIPTION =====
  useEffect(() => {
    console.log('🔥🔥🔥 [REALTIME useEffect] EXECUTADO!', {
      timestamp: new Date().toISOString(),
      workspaceId: selectedWorkspace?.workspace_id
    });
    
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    console.log('🔍 [REALTIME] Verificando dados:', {
      hasUserData: !!currentUserData,
      userId: currentUserData?.id,
      hasWorkspace: !!selectedWorkspace?.workspace_id
    });
    
    if (!currentUserData?.id || !selectedWorkspace?.workspace_id) {
      console.log('⏸️ [REALTIME] ABORTADO - faltam dados');
      return;
    }

    const workspaceId = selectedWorkspace.workspace_id;
    const channelName = `conversations-realtime-${workspaceId}`;
    
    console.log('🔌🔌🔌 [REALTIME] Iniciando subscription do canal:', channelName);

    const conversationsChannel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `workspace_id=eq.${workspaceId}`
      },
        async (payload) => {
          const newConv = payload.new as any;
          
          if (newConv.canal !== 'whatsapp') {
            return;
          }
          
          // Buscar dados completos da nova conversa incluindo connection
          const { data: conversationData, error: convError } = await supabase
            .from('conversations')
            .select(`
              id,
              agente_ativo,
              agent_active_id,
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
              ),
              connections!conversations_connection_id_fkey (
                id,
                instance_name,
                phone_number,
                status
              )
            `)
            .eq('id', newConv.id)
            .eq('workspace_id', workspaceId)
            .single();

          if (convError) {
            console.error('❌ [Realtime] Erro ao buscar dados da conversa:', convError);
            return;
          }

          if (!conversationData?.contacts || !Array.isArray(conversationData.contacts) || conversationData.contacts.length === 0) {
            console.error('❌ [Realtime] Contato não encontrado para conversa:', conversationData);
            return;
          }

          const contact = conversationData.contacts[0];
          const connection = Array.isArray(conversationData.connections) && conversationData.connections.length > 0 
            ? conversationData.connections[0] 
            : null;

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
            agent_active_id: conversationData.agent_active_id ?? null,
            status: conversationData.status as 'open' | 'closed' | 'pending',
            unread_count: conversationData.unread_count || 0,
            last_activity_at: conversationData.last_activity_at,
            created_at: conversationData.created_at,
            evolution_instance: conversationData.evolution_instance ?? null,
            connection_id: conversationData.connection_id ?? null,
            connection: connection,
            assigned_user_id: conversationData.assigned_user_id ?? null,
            conversation_tags: [],
            messages: [],
            last_message: [],
          };

          console.log('✅ [Realtime] Adicionando nova conversa:', {
            id: newConversation.id,
            contact: newConversation.contact.name,
            phone: newConversation.contact.phone,
            status: newConversation.status,
            connection: connection?.instance_name
          });

          setConversations(prev => {
            const exists = prev.some(conv => conv.id === newConversation.id);
            if (exists) {
              console.log('⚠️ [Realtime] Conversa duplicada ignorada:', newConversation.id);
              return prev;
            }
            
            console.log('✅ [Realtime] Conversa adicionada ao estado. Total:', prev.length + 1);
            return [newConversation, ...prev];
          });
        }
      )
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `workspace_id=eq.${workspaceId}`
      }, (payload) => {
          console.log('🔄 [REALTIME-CONVERSATIONS] ✅ CONVERSA ATUALIZADA:', payload.new.id);

          const updatedFields = payload.new as any;

          setConversations(prev => {
            const existingConv = prev.find(c => c.id === updatedFields.id);

            if (!existingConv) {
              console.log('⚠️ Conversa atualizada não existe na lista local, ignorando...');
              return prev;
            }

            // ✅ MERGE: Manter dados relacionados, atualizar apenas campos básicos
            const mergedConversation = {
              ...existingConv,  // Mantém contact, last_message, connection, etc
              agente_ativo: updatedFields.agente_ativo,
              status: updatedFields.status,
              unread_count: updatedFields.unread_count ?? existingConv.unread_count,
              last_activity_at: updatedFields.last_activity_at,
              assigned_user_id: updatedFields.assigned_user_id,
              assigned_user_name: updatedFields.assigned_user_name ?? existingConv.assigned_user_name,
              _updated_at: Date.now() // Força re-render
            };

            // ✅ Remover conversas APENAS se forem explicitamente encerradas
            if (updatedFields.status === 'closed') {
              console.log('🗑️ Removendo conversa encerrada da lista:', updatedFields.id);
              return prev.filter(c => c.id !== updatedFields.id);
            }

            // Para qualquer outro status, MANTER a conversa na lista
            // Os filtros de UI (tabs) cuidarão da visualização

            // Atualizar conversa e reordenar lista
            return prev
              .map(c => c.id === updatedFields.id ? mergedConversation : c)
              .sort((a, b) => 
                new Date(b.last_activity_at || b.created_at).getTime() - 
                new Date(a.last_activity_at || a.created_at).getTime()
              );
          });
        }
      )
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `workspace_id=eq.${workspaceId}`
      }, (payload) => {
          console.log('📨📨📨 [REALTIME-MESSAGES] ✅ NOVA MENSAGEM DETECTADA:', {
            messageId: payload.new.id,
            conversationId: payload.new.conversation_id,
            content: (payload.new as any).content?.substring(0, 50),
            sender_type: payload.new.sender_type,
            created_at: payload.new.created_at,
            timestamp: new Date().toISOString()
          });

          const newMessage = payload.new as any;

          setConversations(prev => {
            console.log('🔄 [REALTIME-MESSAGES] Processando atualização de conversa:', {
              totalConversations: prev.length,
              targetConversationId: newMessage.conversation_id
            });
            
            // Atualizar a conversa com a nova mensagem
            const updated = prev.map(conv => {
              if (conv.id === newMessage.conversation_id) {
                console.log('✅✅✅ [REALTIME-MESSAGES] ATUALIZANDO CARD:', {
                  conversationId: conv.id,
                  contactName: conv.contact.name,
                  oldLastActivity: conv.last_activity_at,
                  newLastActivity: newMessage.created_at,
                  newContent: newMessage.content?.substring(0, 30)
                });
                
                return {
                  ...conv,
                  last_message: [{
                    content: newMessage.content,
                    message_type: newMessage.message_type,
                    sender_type: newMessage.sender_type,
                    created_at: newMessage.created_at
                  }],
                  last_activity_at: newMessage.created_at,
                  _updated_at: Date.now() // Forçar re-render
                };
              }
              return conv;
            });
            
            console.log('📊 [REALTIME-MESSAGES] Reordenando lista...');
            // Reordenar lista por última atividade
            const sorted = updated.sort((a, b) => 
              new Date(b.last_activity_at || b.created_at).getTime() - 
              new Date(a.last_activity_at || a.created_at).getTime()
            );
            
            console.log('✅ [REALTIME-MESSAGES] Lista atualizada e reordenada');
            return sorted;
          });
        }
      )
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `workspace_id=eq.${workspaceId}`
      }, (payload) => {
          console.log('📨 [REALTIME-NOTIFICATIONS] Nova notificação:', {
            notificationId: payload.new.id,
            conversationId: payload.new.conversation_id,
            timestamp: new Date().toISOString()
          });

          const newNotification = payload.new as any;

          if (!newNotification.is_read) {
            setConversations(prev => prev.map(conv => {
              if (conv.id === newNotification.conversation_id) {
                console.log('🔔 [REALTIME] Incrementando unread_count:', {
                  conversationId: conv.id,
                  currentCount: conv.unread_count,
                  newCount: (conv.unread_count || 0) + 1
                });
                
                return {
                  ...conv,
                  unread_count: (conv.unread_count || 0) + 1,
                  _updated_at: Date.now() // Forçar re-render
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
        console.log('📡📡📡 [REALTIME-STATUS] Status da subscrição mudou:', {
          status,
          channelName,
          workspaceId,
          timestamp: new Date().toISOString(),
          listeners: ['conversations:INSERT', 'conversations:UPDATE', 'messages:INSERT', 'notifications:INSERT', 'notifications:UPDATE']
        });
        
        if (status === 'SUBSCRIBED') {
          console.log('✅✅✅ [REALTIME] CANAL SUBSCRITO COM SUCESSO!');
          console.log('👂 Aguardando eventos de INSERT/UPDATE em conversations, messages e notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal, tentando reconectar...');
          setTimeout(() => fetchConversations(), 3000);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Timeout, reconectando...');
          setTimeout(() => fetchConversations(), 3000);
        } else if (status === 'CLOSED') {
          console.error('🔌 Canal fechado');
        } else {
          console.log(`🔄 [REALTIME] Status intermediário: ${status}`);
        }
      });

    return () => {
      console.log('🔌 [Realtime] Cleanup:', workspaceId);
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