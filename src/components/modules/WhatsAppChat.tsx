import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRealtimeNotifications } from "@/components/RealtimeNotificationProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { getConnectionColor } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/avatarUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageStatusIndicator } from "@/components/ui/message-status-indicator";
import { useWhatsAppConversations, WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useAuth } from "@/hooks/useAuth";
import { useTags } from "@/hooks/useTags";
import { useProfileImages } from "@/hooks/useProfileImages";
import { useInstanceAssignments } from "@/hooks/useInstanceAssignments";
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useQueues } from "@/hooks/useQueues";
import { useWorkspaceAgent } from "@/hooks/useWorkspaceAgent";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parsePhoneNumber } from 'libphonenumber-js';
import { MediaViewer } from "@/components/chat/MediaViewer";
import { MediaUpload } from "@/components/chat/MediaUpload";
import { QuickItemsModal } from "@/components/modals/QuickItemsModal";
import { QuotedMessagePreview } from "@/components/chat/QuotedMessagePreview";
import { PeekConversationModal } from "@/components/modals/PeekConversationModal";
import { AcceptConversationButton } from "@/components/chat/AcceptConversationButton";
import { EndConversationButton } from "@/components/chat/EndConversationButton";
import { AddTagButton } from "@/components/chat/AddTagButton";
import { ContactSidePanel } from "@/components/ContactSidePanel";
import { ContactTags } from "@/components/chat/ContactTags";
import { MessageContextMenu } from "@/components/chat/MessageContextMenu";
import { MessageSelectionBar } from "@/components/chat/MessageSelectionBar";
import { ForwardMessageModal } from "@/components/modals/ForwardMessageModal";
import { ConnectionBadge } from "@/components/chat/ConnectionBadge";
import { ReplyPreview } from "@/components/chat/ReplyPreview";
import { SelectAgentModal } from "@/components/modals/SelectAgentModal";
import { ChangeAgentModal } from "@/components/modals/ChangeAgentModal";
import { QuickFunnelsModal } from "@/components/modals/QuickFunnelsModal";
import { AssignmentHistoryModal } from "@/components/modals/AssignmentHistoryModal";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { FloatingDateIndicator } from "@/components/chat/FloatingDateIndicator";
import { useFloatingDate, groupMessagesByDate, formatMessageDate } from "@/hooks/useFloatingDate";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Send, Bot, Phone, MoreVertical, Circle, MessageCircle, ArrowRight, Settings, Users, Trash2, ChevronDown, Filter, Eye, RefreshCw, Mic, Square, X, Check, PanelLeft, UserCircle, UserX, UsersRound, Tag, Plus, Loader2, Workflow, Clock } from "lucide-react";
import { WhatsAppChatSkeleton } from "@/components/chat/WhatsAppChatSkeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ConversationMessage = ReturnType<typeof useConversationMessages>['messages'][number];
type DisplayMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
interface WhatsAppChatProps {
  isDarkMode?: boolean;
  selectedConversationId?: string | null;
  onlyMessages?: boolean;
}
export function WhatsAppChat({
  isDarkMode = false,
  selectedConversationId,
  onlyMessages = false
}: WhatsAppChatProps) {
  // Usar notificações para saber quais conversas têm mensagens não lidas  
  const { notifications } = useRealtimeNotifications();
  const { markContactAsRead } = useNotifications();
  
  useEffect(() => {
    console.log('🔔 [WhatsAppChat] Notificações MUDARAM:', {
      total: notifications.length,
      timestamp: new Date().toISOString(),
      notifications: notifications.map(n => ({
        conversationId: n.conversationId,
        content: n.content
      }))
    });
  }, [notifications]);
  
  // Criar mapa de conversas com notificações não lidas
  const conversationNotifications = useMemo(() => {
    const map = new Map<string, number>();
    notifications.forEach(notif => {
      const currentCount = map.get(notif.conversationId) || 0;
      map.set(notif.conversationId, currentCount + 1);
    });
    console.log('🔔 [WhatsAppChat] Mapa de notificações RECALCULADO:', Array.from(map.entries()));
    return map;
  }, [notifications]);
  
  // Usar hook completo de conversas
  const {
    conversations,
    markAsRead,
    assumirAtendimento,
    reativarIA,
    clearAllConversations,
    acceptConversation,
    fetchConversations,
    loading,
    sendMessage
  } = useWhatsAppConversations();
  
  // Debug: Detectar mudanças no array de conversas
  useEffect(() => {
    console.log('🔄 [WhatsAppChat] Array de conversas MUDOU:', {
      total: conversations.length,
      conversationIds: conversations.map(c => ({ id: c.id, name: c.contact.name, status: c.status })),
      timestamp: new Date().toISOString()
    });
  }, [conversations.length, conversations]);


  // ✅ Hook específico para mensagens (lazy loading)
  const {
    messages,
    loading: messagesLoading,
    loadingMore,
    hasMore,
    loadInitial: loadMessages,
    loadMore: loadMoreMessages,
    addMessage,
    updateMessage,
    removeMessage, // ✅ NOVO: função para remover mensagem
    clearMessages
  } = useConversationMessages();
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    updateConversationAgentStatus
  } = usePipelinesContext();
  const {
    user
  } = useAuth();
  const {
    tags
  } = useTags();
  const {
    fetchProfileImage,
    isLoading: isLoadingProfileImage
  } = useProfileImages();
  const {
    assignments
  } = useInstanceAssignments();
  const {
    connections: workspaceConnections,
    isLoading: connectionsLoading
  } = useWorkspaceConnections(selectedWorkspace?.workspace_id);
  const {
    queues,
    loading: queuesLoading
  } = useQueues();
  const {
    toast
  } = useToast();
  
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [changeAgentModalOpen, setChangeAgentModalOpen] = useState(false);
  const [assignmentHistoryModalOpen, setAssignmentHistoryModalOpen] = useState(false);

  // Verificar se há agente ativo na conversa selecionada
  const { hasAgent, isLoading: agentLoading, agent } = useWorkspaceAgent(selectedConversation?.id);

  // Log do estado do agente após selectedConversation estar disponível
  useEffect(() => {
    if (selectedConversation) {
      console.log('🎯 WhatsAppChat - Estado do Agente:', { 
        hasAgent, 
        agentLoading, 
        agentName: agent?.name,
        conversationId: selectedConversation.id,
        conversationActive: selectedConversation.agente_ativo,
        contactName: selectedConversation.contact.name
      });
    }
  }, [hasAgent, agentLoading, agent, selectedConversation?.agente_ativo, selectedConversation?.id]);

  // ✅ CRÍTICO: Sincronizar selectedConversation quando conversations mudar
  useEffect(() => {
    if (!selectedConversation) return;
    
    console.log('🔍 Verificando sincronização:', {
      selectedConvId: selectedConversation.id,
      totalConversations: conversations.length,
      selectedAgenteAtivo: selectedConversation.agente_ativo
    });
    
    const updatedConversation = conversations.find(c => c.id === selectedConversation.id);
    
    if (!updatedConversation) {
      console.log('⚠️ Conversa não encontrada no array');
      return;
    }
    
    console.log('🔍 Conversa encontrada no array:', {
      found: true,
      updatedAgenteAtivo: updatedConversation.agente_ativo,
      currentAgenteAtivo: selectedConversation.agente_ativo,
      needsUpdate: updatedConversation.agente_ativo !== selectedConversation.agente_ativo
    });
    
    // ✅ SEMPRE atualizar para garantir que temos a versão mais recente
    if (updatedConversation.agente_ativo !== selectedConversation.agente_ativo || 
        updatedConversation.agent_active_id !== selectedConversation.agent_active_id ||
        updatedConversation._updated_at !== selectedConversation._updated_at) {
      console.log('🔄 Atualizando selectedConversation:', {
        oldAgenteAtivo: selectedConversation.agente_ativo,
        newAgenteAtivo: updatedConversation.agente_ativo,
        oldAgentId: selectedConversation.agent_active_id,
        newAgentId: updatedConversation.agent_active_id,
        timestamp: updatedConversation._updated_at
      });
      setSelectedConversation(updatedConversation);
    }
  }, [conversations, selectedConversation]);

  // 🔄 Listener realtime para atualizações de conversas
  useEffect(() => {
    if (!selectedConversation?.id) return;

    console.log('👂 Configurando listener realtime para conversa:', selectedConversation.id);

    const channel = supabase
      .channel(`conversation-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${selectedConversation.id}`
        },
        (payload) => {
          console.log('🔔 Atualização realtime recebida:', payload);
          
          // Atualizar imediatamente o estado local
          setSelectedConversation(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              agente_ativo: payload.new.agente_ativo,
              agent_active_id: payload.new.agent_active_id,
              _updated_at: Date.now()
            };
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Desconectando listener realtime');
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);
  const [quickPhoneNumber, setQuickPhoneNumber] = useState("");
  const [isCreatingQuickConversation, setIsCreatingQuickConversation] = useState(false);
  const [showAllQueues, setShowAllQueues] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [showSelectAgentModal, setShowSelectAgentModal] = useState(false);
  const [quickFunnelsModalOpen, setQuickFunnelsModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [isUpdatingProfileImages, setIsUpdatingProfileImages] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [customFiltersOpen, setCustomFiltersOpen] = useState(false);

  // Estados para as abas baseadas no papel
  const [activeTab, setActiveTab] = useState<string>('all');

  // Definir abas baseado no papel do usuário  
  const getUserTabs = () => {
    const userProfile = user?.profile;
    if (userProfile === 'master' || userProfile === 'admin') {
      // Master e Admin: apenas "Todas" e "Não designadas"
      return [{
        id: 'all',
        label: 'Todas as conversas',
        count: conversations.filter(c => c.status !== 'closed').length
      }, {
        id: 'unassigned',
        label: 'Conversas não atribuídas',
        count: conversations.filter(c => !c.assigned_user_id && c.status !== 'closed').length
      }];
    } else {
      // User: apenas suas conversas e não designadas (excluindo encerradas)
      const myConversations = conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed');
      const unassignedConversations = conversations.filter(c => !c.assigned_user_id && c.status !== 'closed');
      return [{
        id: 'mine',
        label: 'Minhas',
        count: myConversations.length
      }, {
        id: 'unassigned',
        label: 'Conversas não atribuídas',
        count: unassignedConversations.length
      }];
    }
  };
  const tabs = getUserTabs();

  // Filtrar conversas baseado na aba ativa e filtros (useMemo para garantir re-render)
  const filteredConversations = useMemo(() => {
    let filtered = [];

    console.log('🔍 [Filter] Recalculando conversas filtradas:', {
      totalConversations: conversations.length,
      activeTab,
      selectedTag,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    // Filtrar por aba
    switch (activeTab) {
      case 'all':
        // Incluir todas exceto fechadas
        filtered = conversations.filter(c => c.status !== 'closed');
        break;
      case 'mine':
        filtered = conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed');
        break;
      case 'unassigned':
        filtered = conversations.filter(c => !c.assigned_user_id && c.status !== 'closed');
        break;
      case 'unread':
        // Filtrar por conversas que TÊM notificações não lidas para este usuário
        filtered = conversations.filter(c => conversationNotifications.has(c.id) && c.status !== 'closed');
        break;
      default:
        filtered = conversations.filter(c => c.status !== 'closed');
    }

    console.log('🔍 [Filter] Após filtro de aba:', {
      filtered: filtered.length,
      activeTab
    });

    // Filtrar por tag se selecionada (ignorar "all" ou string vazia)
    if (selectedTag && selectedTag !== "all") {
      filtered = filtered.filter(conv => {
        // Buscar tags do CONTATO (não da conversa)
        const contactId = conv.contact?.id;
        if (!contactId) return false;
        
        // Verificar se o contato tem a tag selecionada
        const contactHasTag = tags.some(tag => 
          tag.id === selectedTag && 
          tag.contact_tags?.some(ct => ct.contact_id === contactId)
        );
        
        return contactHasTag;
      });
    }

    // Filtrar por conexão se selecionada
    if (selectedConnection && selectedConnection !== "all") {
      filtered = filtered.filter(conv => conv.connection_id === selectedConnection);
    }

    // Filtrar por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(conv => conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || conv.contact.phone && conv.contact.phone.includes(searchTerm));
    }
    
    console.log('✅ [Filter] Conversas filtradas finais:', filtered.length);
    return filtered;
  }, [conversations, activeTab, selectedTag, selectedConnection, searchTerm, user?.id, conversationNotifications, tags]);
  const [peekModalOpen, setPeekModalOpen] = useState(false);
  const [peekConversationId, setPeekConversationId] = useState<string | null>(null);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [quickItemsModalOpen, setQuickItemsModalOpen] = useState(false);

  // Estados para modo de seleção e encaminhamento
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);

  // Hook para data flutuante
  const { floatingDate, shouldShowFloating } = useFloatingDate(messagesScrollRef, messages);

  // Agrupar mensagens por data
  const messagesByDate = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Estados para controle de carregamento manual
  const isInitialLoadRef = useRef(true);
  
  // ✅ MUTEX: Prevenir envio duplicado
  const sendingRef = useRef<Set<string>>(new Set());
  
  // ✅ Estado para desabilitar botão durante envio
  const [isSending, setIsSending] = useState(false);

  // Marcar como lida automaticamente ao abrir conversa
  useEffect(() => {
    if (selectedConversation && conversationNotifications.has(selectedConversation.id)) {
      console.log('📖 Marcando conversa como lida:', selectedConversation.contact.name);
      markContactAsRead(selectedConversation.id);
    }
  }, [selectedConversation?.id]);


  // ✅ Enviar mensagem - OTIMIZADO
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || isSending) return;
    
    const messageKey = `${selectedConversation.id}-${messageText.trim()}`;
    if (sendingRef.current.has(messageKey)) return;
    
    setIsSending(true);
    sendingRef.current.add(messageKey);
    
    const textToSend = messageText.trim();
    setMessageText('');
    
    try {
      const clientMessageId = crypto.randomUUID();
      
      // ✅ Mensagem otimista - começa com 'sending'
      const optimisticMessage = {
        id: clientMessageId,
        external_id: clientMessageId,
        conversation_id: selectedConversation.id,
        content: textToSend,
        message_type: 'text' as const,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || '',
        ...(replyingTo && {
          reply_to_message_id: replyingTo.id,
          quoted_message: {
            id: replyingTo.external_id || replyingTo.evolution_key_id || replyingTo.id,
            content: replyingTo.content,
            sender_type: replyingTo.sender_type,
            external_id: replyingTo.external_id || replyingTo.evolution_key_id,
            message_type: replyingTo.message_type,
            file_url: replyingTo.file_url,
            file_name: replyingTo.file_name
          }
        })
      };
      
      addMessage(optimisticMessage);
      setReplyingTo(null);
      
      // ✅ Enviar para backend (assíncrono, não bloqueia UI)
      supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: textToSend,
          message_type: 'text',
          sender_id: user?.id,
          sender_type: 'agent',
          clientMessageId: clientMessageId,
          ...(replyingTo && {
            reply_to_message_id: replyingTo.id,
            quoted_message: {
              id: replyingTo.external_id || replyingTo.evolution_key_id || replyingTo.id,
              content: replyingTo.content,
              sender_type: replyingTo.sender_type,
              external_id: replyingTo.external_id || replyingTo.evolution_key_id,
              message_type: replyingTo.message_type,
              file_url: replyingTo.file_url,
              file_name: replyingTo.file_name
            }
          })
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      }).then(({ error, data: sendResult }) => {
        if (error || !sendResult?.success) {
          console.error('❌ Erro ao enviar:', error);
          updateMessage(clientMessageId, { status: 'failed' });
          toast({
            title: "Erro ao enviar",
            description: "Não foi possível enviar a mensagem.",
            variant: "destructive"
          });
        }
      });
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
      setTimeout(() => sendingRef.current.delete(messageKey), 500);
    }
  };

  // ✅ Enviar mensagens rápidas - OTIMIZADO
  const handleSendQuickMessage = async (content: string, type: 'text') => {
    if (!selectedConversation) return;
    
    const messageKey = `quick-${selectedConversation.id}-${content.trim()}`;
    if (sendingRef.current.has(messageKey)) return;
    sendingRef.current.add(messageKey);
    
    try {
      const clientMessageId = crypto.randomUUID();
      
      const optimisticMessage = {
        id: clientMessageId,
        external_id: clientMessageId,
        conversation_id: selectedConversation.id,
        content: content,
        message_type: type as any,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      
      addMessage(optimisticMessage);
      
      // ✅ Enviar para backend (assíncrono)
      supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content,
          message_type: type,
          sender_id: user?.id,
          sender_type: 'agent',
          clientMessageId: clientMessageId
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      }).catch(error => {
        console.error('Erro ao enviar mensagem rápida:', error);
        updateMessage(clientMessageId, { status: 'failed' });
      });
      
    } finally {
      setTimeout(() => sendingRef.current.delete(messageKey), 500);
    }
  };
  const handleSendQuickAudio = async (file: {
    name: string;
    url: string;
  }, content: string) => {
    if (!selectedConversation) return;
    
    // ✅ MUTEX: Prevenir duplicação (SEM Date.now())
    const messageKey = `audio-${selectedConversation.id}-${file.url}`;
    if (sendingRef.current.has(messageKey)) {
      console.log('⏭️ Ignorando envio duplicado de áudio');
      return;
    }
    sendingRef.current.add(messageKey);
    
    try {
      // ✅ Gerar clientMessageId ANTES de criar mensagem otimista
      const clientMessageId = crypto.randomUUID();
      
      const optimisticMessage = {
        id: clientMessageId, // ✅ Usar clientMessageId como ID temporário
        external_id: clientMessageId, // ✅ Incluir external_id para correspondência
        conversation_id: selectedConversation.id,
        content: content || '[ÁUDIO]',
        message_type: 'audio' as const,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        file_url: file.url,
        file_name: file.name,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content || '[ÁUDIO]',
          message_type: 'audio',
          sender_id: user?.id,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name,
          clientMessageId: clientMessageId // ✅ Usar o mesmo clientMessageId
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar áudio');
      }
      // ✅ Não remover mensagem otimista - a subscription realtime vai substituí-la
    } catch (error) {
      console.error('Erro ao enviar áudio rápido:', error);
    } finally {
      setTimeout(() => sendingRef.current.delete(messageKey), 1000);
    }
  };
  const handleSendQuickMedia = async (file: {
    name: string;
    url: string;
  }, content: string, type: 'image' | 'video') => {
    if (!selectedConversation) return;
    
    // ✅ MUTEX: Prevenir duplicação (SEM Date.now())
    const messageKey = `media-${selectedConversation.id}-${file.url}`;
    if (sendingRef.current.has(messageKey)) {
      console.log('⏭️ Ignorando envio duplicado de mídia');
      return;
    }
    sendingRef.current.add(messageKey);
    
    try {
      // ✅ Gerar clientMessageId ANTES de criar mensagem otimista
      const clientMessageId = crypto.randomUUID();
      
      const optimisticMessage = {
        id: clientMessageId, // ✅ Usar clientMessageId como ID temporário
        external_id: clientMessageId, // ✅ Incluir external_id para correspondência
        conversation_id: selectedConversation.id,
        content: content || `[${type.toUpperCase()}]`,
        message_type: type as any,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        file_url: file.url,
        file_name: file.name,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content || `[${type.toUpperCase()}]`,
          message_type: type,
          sender_id: user?.id,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name,
          clientMessageId: clientMessageId // ✅ Usar o mesmo clientMessageId
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar mídia');
      }
      // ✅ Não remover mensagem otimista - a subscription realtime vai substituí-la
    } catch (error) {
      console.error('Erro ao enviar mídia rápida:', error);
    } finally {
      setTimeout(() => sendingRef.current.delete(messageKey), 1000);
    }
  };
  const handleSendQuickDocument = async (file: {
    name: string;
    url: string;
  }, content: string) => {
    if (!selectedConversation) return;
    
    // ✅ MUTEX: Prevenir duplicação (SEM Date.now())
    const messageKey = `doc-${selectedConversation.id}-${file.url}`;
    if (sendingRef.current.has(messageKey)) {
      console.log('⏭️ Ignorando envio duplicado de documento');
      return;
    }
    sendingRef.current.add(messageKey);
    
    try {
      // ✅ Gerar clientMessageId ANTES de criar mensagem otimista
      const clientMessageId = crypto.randomUUID();
      
      const optimisticMessage = {
        id: clientMessageId, // ✅ Usar clientMessageId como ID temporário
        external_id: clientMessageId, // ✅ Incluir external_id para correspondência
        conversation_id: selectedConversation.id,
        content: content || '[DOCUMENTO]',
        message_type: 'document' as any,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        file_url: file.url,
        file_name: file.name,
        created_at: new Date().toISOString(),
        status: 'sending' as const,
        workspace_id: selectedWorkspace?.workspace_id || ''
      };
      addMessage(optimisticMessage);
      const {
        data: sendResult,
        error
      } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: selectedConversation.id,
          content: content || '[DOCUMENTO]',
          message_type: 'document',
          sender_id: user?.id,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name,
          clientMessageId: clientMessageId // ✅ Usar o mesmo clientMessageId
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar documento');
      }
      // ✅ Não remover mensagem otimista - a subscription realtime vai substituí-la
    } catch (error) {
      console.error('Erro ao enviar documento rápido:', error);
    } finally {
      setTimeout(() => sendingRef.current.delete(messageKey), 1000);
    }
  };

  // ✅ CORREÇÃO 3: Usar ref para rastrear conversas já carregadas
  const loadedConversationsRef = useRef<Set<string>>(new Set());

  // ✅ REMOVIDO: Subscription duplicada que causava conflito com useConversationMessages
  // A subscription de UPDATE agora está centralizada em useConversationMessages.ts

  // ✅ Selecionar conversa e carregar mensagens lazy
  const handleSelectConversation = async (conversation: WhatsAppConversation) => {
    console.log('🎯 [handleSelectConversation] Selecionando conversa:', {
      conversationId: conversation.id,
      contactName: conversation.contact.name
    });

    setSelectedConversation(conversation);

    // Limpar modo de seleção ao trocar de conversa
    setSelectionMode(false);
    setSelectedMessages(new Set());

    // Resetar estados de scroll
    isInitialLoadRef.current = true;
    setShouldAutoScroll(true);
    setIsAtBottom(true);

    // ✅ Carregar mensagens com refresh forçado para garantir status atualizado
    console.log('📥 [handleSelectConversation] Atualizando mensagens:', conversation.id);
    clearMessages(); // Limpar mensagens da conversa anterior (somente na troca)
    await loadMessages(conversation.id, true); // ✅ forceRefresh = true
    
    // Marcar notificações e conversa como lidas SEMPRE ao abrir conversa
    console.log('🔔 [WhatsAppChat] Marcando conversa como lida:', conversation.id);
    markContactAsRead(conversation.id); // atualiza sino/notificações
    try { await markAsRead(conversation.id); } catch (e) { console.warn('⚠️ markAsRead falhou (continua):', e); }
  };

  // ✅ Evitar loop: abrir automaticamente a conversa selecionada apenas quando mudar o ID
  const lastAutoOpenedIdRef = useRef<string | null>(null);
  const isAutoOpeningRef = useRef(false);

  useEffect(() => {
    if (!selectedConversationId) return;
    // Se já abrimos esta conversa automaticamente, não repetir
    if (lastAutoOpenedIdRef.current === selectedConversationId) return;

    const conv = conversations.find(c => c.id === selectedConversationId);
    if (!conv) return;

    (async () => {
      try {
        isAutoOpeningRef.current = true;
        await handleSelectConversation(conv);
        lastAutoOpenedIdRef.current = selectedConversationId;
      } finally {
        isAutoOpeningRef.current = false;
      }
    })();
  }, [selectedConversationId, conversations]);

  // Funções de seleção e encaminhamento
  const handleMessageForward = (messageId: string) => {
    setSelectionMode(true);
    setSelectedMessages(new Set([messageId]));
  };
  
  const scrollToMessage = (messageId: string) => {
    if (!messagesScrollRef.current) return;
    
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Highlight temporário da mensagem
      messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    } else {
      toast({
        title: "Mensagem não encontrada",
        description: "A mensagem citada pode ter sido deletada ou não está carregada",
        variant: "destructive"
      });
    }
  };
  
  const toggleMessageSelection = (messageId: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessages(newSelected);

    // Sair do modo de seleção se não houver mensagens selecionadas
    if (newSelected.size === 0) {
      setSelectionMode(false);
    }
  };
  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };
  const handleForwardMessages = async (contactIds: string[]) => {
    if (!selectedConversation || selectedMessages.size === 0) return;
    const messagesToForward = messages.filter(msg => selectedMessages.has(msg.id));
    for (const contactId of contactIds) {
      // Buscar a conversa do contato
      const targetConversation = conversations.find(conv => conv.contact.id === contactId);
      if (targetConversation) {
        // Encaminhar cada mensagem selecionada
        for (const msg of messagesToForward) {
          try {
            await supabase.functions.invoke('test-send-msg', {
              body: {
                conversation_id: targetConversation.id,
                content: msg.content,
                message_type: msg.message_type,
                sender_id: user?.id,
                sender_type: 'agent',
                file_url: msg.file_url,
                file_name: msg.file_name,
                clientMessageId: crypto.randomUUID() // ✅ ETAPA 2
              },
              headers: {
                'x-system-user-id': user?.id || '',
                'x-system-user-email': user?.email || '',
                'x-workspace-id': selectedWorkspace?.workspace_id || ''
              }
            });
          } catch (error) {
            console.error('Erro ao encaminhar mensagem:', error);
          }
        }
      }
    }
    toast({
      title: "Mensagens encaminhadas",
      description: `${messagesToForward.length} mensagem(ns) encaminhada(s) com sucesso`
    });
    cancelSelection();
  };

  // Obter horário da última atividade
  const getActivityDisplay = (conv: WhatsAppConversation) => {
    const now = new Date();
    const messageTime = new Date(conv.last_activity_at);
    const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      // Menos de 24h: mostrar horário
      return messageTime.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Mais de 24h: mostrar data
      return messageTime.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  // ✅ Última mensagem não existe mais no array (lazy loading)
  const getLastMessage = (conv: WhatsAppConversation) => {
    // Retorna null - sem preview de mensagem na lista
    return null;
  };

  // ✅ SIMPLIFICADO: Mapear status (Evolution e Z-API já normalizam no backend)
  const getDisplayMessageStatus = (message: ConversationMessage): DisplayMessageStatus | undefined => {
    if (!message || message.sender_type === 'contact') return undefined;

    const status = message.status?.toLowerCase();
    
    console.log('🔍 [getDisplayMessageStatus]:', {
      messageId: message.id,
      external_id: message.external_id,
      rawStatus: message.status,
      normalizedStatus: status,
      delivered_at: message.delivered_at,
      read_at: message.read_at,
      sender_type: message.sender_type
    });

    // ✅ Mapear status direto (já vem normalizado do backend)
    switch (status) {
      case 'sending':
      case 'pending':
        return 'sending';
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return 'sent'; // fallback
    }
  };

  const getSenderDisplayName = (
    senderType: ConversationMessage['sender_type'] | undefined,
    contactName: string
  ) => {
    switch (senderType) {
      case 'contact':
        return contactName || 'Contato';
      case 'system':
        return 'Sistema';
      case 'ia':
        return 'Assistente IA';
      default:
        return 'Você';
    }
  };

  // Importadas de avatarUtils para consistência

  // Gerenciar agente IA
  const handleToggleAgent = async () => {
    if (selectedConversation) {
      console.log('🎯 handleToggleAgent chamado:', {
        conversationId: selectedConversation.id,
        currentState: selectedConversation.agente_ativo,
        willCall: selectedConversation.agente_ativo ? 'assumirAtendimento' : 'reativarIA'
      });
      
      // Se está ativo, desativar (assumir atendimento)
      if (selectedConversation.agente_ativo) {
        const newAgenteAtivoState = false;
        
        // 🔥 UPDATE OTIMISTA: Atualizar estado local imediatamente
        setSelectedConversation(prev => prev ? {
          ...prev,
          agente_ativo: newAgenteAtivoState,
          _updated_at: Date.now()
        } : null);
        
        // 🔥 UPDATE OTIMISTA NO PIPELINES CONTEXT (para cards CRM)
        updateConversationAgentStatus(selectedConversation.id, false, null);
        
        await assumirAtendimento(selectedConversation.id);
      } else {
        // Se está inativo, abrir modal de seleção de agente
        setShowSelectAgentModal(true);
      }
    }
  };

  // Auto-scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  
  // ✅ Ref para rastrear o último tamanho do array de mensagens
  const lastMessageLengthRef = useRef(0);

  // Gravação de áudio (microfone)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);

      // Iniciar timer
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast({
        title: "Erro ao gravar",
        description: "Não foi possível acessar o microfone",
        variant: "destructive"
      });
    }
  };
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      toast({
        title: "Gravação cancelada",
        description: "O áudio não foi enviado"
      });
    }
  };
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm'
        });

        // Limpar stream
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        // Limpar intervalo do timer
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        const fileExt = 'webm';
        const fileName = `audio_${Date.now()}.${fileExt}`;
        const filePath = `messages/${fileName}`;
        const {
          error: uploadError
        } = await supabase.storage.from('whatsapp-media').upload(filePath, audioBlob, {
          contentType: 'audio/webm'
        });
        if (uploadError) {
          throw uploadError;
        }
        const {
          data: {
            publicUrl
          }
        } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
        if (selectedConversation) {
          const optimisticMessage = {
            id: `temp-audio-${Date.now()}`,
            conversation_id: selectedConversation.id,
            content: messageText.trim() || '[AUDIO]',
            message_type: 'audio' as const,
            sender_type: 'agent' as const,
            sender_id: user?.id,
            file_url: publicUrl,
            file_name: fileName,
            created_at: new Date().toISOString(),
            status: 'sending' as const,
            workspace_id: selectedWorkspace?.workspace_id || ''
          };
          addMessage(optimisticMessage);
          setMessageText('');
          try {
            const {
              data: sendResult,
              error: sendError
            } = await supabase.functions.invoke('test-send-msg', {
              body: {
                conversation_id: selectedConversation.id,
                content: messageText.trim() || '[AUDIO]',
                message_type: 'audio',
                sender_id: user?.id,
                sender_type: 'agent',
                file_url: publicUrl,
                file_name: fileName
              },
              headers: {
                'x-system-user-id': user?.id || '',
                'x-workspace-id': selectedWorkspace?.workspace_id || '',
                'x-system-user-email': user?.email || ''
              }
            });
            if (sendError) {
              console.error('❌ Erro ao enviar áudio:', sendError);
              updateMessage(optimisticMessage.id, {
                status: 'failed'
              });
              toast({
                title: "Erro ao enviar áudio",
                description: sendError.message,
                variant: "destructive"
              });
            } else {
              console.log('✅ Áudio enviado com sucesso');
              updateMessage(optimisticMessage.id, {
                status: 'sent',
                id: sendResult?.message?.id || optimisticMessage.id
              });
            }
          } catch (err) {
            console.error('Erro ao enviar áudio:', err);
            updateMessage(optimisticMessage.id, {
              status: 'failed'
            });
            toast({
              title: "Erro ao enviar áudio",
              description: "Erro de conexão",
              variant: "destructive"
            });
          }
        }
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
      } catch (error) {
        console.error('Erro ao enviar áudio:', error);
        toast({
          title: "Erro ao enviar áudio",
          description: "Tente novamente",
          variant: "destructive"
        });
        setIsRecording(false);
        setRecordingTime(0);
      }
    };
    mediaRecorderRef.current.stop();
  };

  // Batch update profile images
  const handleBatchUpdateProfileImages = async () => {
    if (isUpdatingProfileImages) return;
    setIsUpdatingProfileImages(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('batch-update-profile-images');
      if (error) throw error;
      toast({
        title: "Atualização iniciada",
        description: `Atualizando fotos de perfil de ${data.totalProcessed} contatos`
      });

      // Refresh conversations to show updated images
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error('Error batch updating profile images:', error);
      toast({
        title: "Erro na atualização",
        description: "Não foi possível atualizar as fotos de perfil",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingProfileImages(false);
    }
  };

  // Refresh individual profile image
  const handleRefreshProfileImage = async (phone: string) => {
    if (!phone) return;
    try {
      await fetchProfileImage(phone);
      toast({
        title: "Foto atualizada",
        description: "A foto do perfil foi atualizada com sucesso"
      });
      // Refresh conversations to show updated image
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error refreshing profile image:', error);
    }
  };

  // Create quick conversation without saving contact
  const handleCreateQuickConversation = async () => {
    if (!quickPhoneNumber.trim() || isCreatingQuickConversation) return;

    // Validar mínimo de 10 dígitos (DDD + número)
    if (quickPhoneNumber.length < 10) {
      toast({
        title: "Número inválido",
        description: "Por favor, digite um número válido com DDD (mínimo 10 dígitos).",
        variant: "destructive"
      });
      return;
    }
    setIsCreatingQuickConversation(true);
    try {
      // Adicionar +55 ao número
      const fullPhoneNumber = `+55${quickPhoneNumber}`;

      // Parse and validate phone number
      const phoneNumber = parsePhoneNumber(fullPhoneNumber, 'BR');
      if (!phoneNumber || !phoneNumber.isValid()) {
        toast({
          title: "Número inválido",
          description: "Por favor, digite um número de telefone válido.",
          variant: "destructive"
        });
        return;
      }

      // PROTEÇÃO: Verificar se não é número de alguma conexão/instância
      const formattedPhone = phoneNumber.format('E.164').replace('+', '');
      const phoneDigits = formattedPhone.replace(/\D/g, '');

      // Verificar contra todas as conexões do workspace atual
      const {
        data: connections
      } = await supabase.from('connections').select('phone_number, instance_name').eq('workspace_id', selectedWorkspace?.workspace_id);
      const isInstanceNumber = connections?.some(conn => {
        const connPhone = conn.phone_number?.replace(/\D/g, '');
        return connPhone && phoneDigits === connPhone;
      });
      if (isInstanceNumber) {
        toast({
          title: "Número inválido",
          description: "Este número pertence a uma instância WhatsApp e não pode ser usado como contato.",
          variant: "destructive"
        });
        return;
      }

      // Call Edge Function to create quick conversation
      console.log('📞 Criando conversa rápida:', {
        original: quickPhoneNumber,
        formatted: phoneNumber.format('E.164'),
        national: phoneNumber.format('NATIONAL')
      });
      if (!selectedWorkspace?.workspace_id) {
        toast({
          title: "Erro",
          description: "Nenhum workspace selecionado",
          variant: "destructive"
        });
        return;
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('create-quick-conversation', {
        body: {
          phoneNumber: phoneNumber.format('E.164')
        },
        headers: {
          'x-workspace-id': selectedWorkspace.workspace_id
        }
      });
      if (error) {
        console.error('❌ Error calling create-quick-conversation:', {
          error,
          errorName: error.name,
          errorMessage: error.message,
          context: error.context
        });
        toast({
          title: "Erro",
          description: error.message || "Não foi possível criar conversa",
          variant: "destructive"
        });
        return;
      }
      if (!data.success) {
        toast({
          title: "Erro",
          description: data.error || "Não foi possível criar conversa",
          variant: "destructive"
        });
        return;
      }

      // Atualizar lista imediatamente
      await fetchConversations();
      
      // Find and select the conversation
      setTimeout(() => {
        const conversation = conversations.find(conv => conv.id === data.conversationId);
        if (conversation) {
          handleSelectConversation(conversation);
        } else {
          // Tentar novamente após refetch
          console.log('⏳ Aguardando lista atualizar...');
          setTimeout(async () => {
            await fetchConversations();
            const retryConv = conversations.find(conv => conv.id === data.conversationId);
            if (retryConv) handleSelectConversation(retryConv);
          }, 1000);
        }
      }, 500);
      setQuickPhoneNumber("");
      toast({
        title: "Conversa criada",
        description: `Conversa iniciada com ${phoneNumber.format('INTERNATIONAL')}`
      });
    } catch (error) {
      console.error('❌ Exception creating quick conversation:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast({
        title: "Erro",
        description: "Não foi possível criar conversa",
        variant: "destructive"
      });
    } finally {
      setIsCreatingQuickConversation(false);
    }
  };

  // Handle Enter key press for quick conversation
  const handleQuickConversationKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateQuickConversation();
    }
  };

  // Handler para responder mensagem
  const handleReply = (message: any) => {
    setReplyingTo(message);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Digite sua mensagem..."]');
      input?.focus();
    }, 100);
  };

  // Detectar se o usuário está no final do chat
  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const element = event.currentTarget;
    const threshold = 100; // pixels de tolerância
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    setIsAtBottom(isNearBottom);
    setShouldAutoScroll(isNearBottom);
    
    console.log('📜 Posição do scroll:', {
      isNearBottom,
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight
    });
  }, []);

  // Evitar segundo disparo de seleção automática por outros caminhos
  useEffect(() => {
    if (!selectedConversationId || conversations.length === 0) return;
    if (lastAutoOpenedIdRef.current === selectedConversationId) return; // já tratamos acima
  }, [selectedConversationId, conversations]);

  // ✅ Scroll inteligente para última mensagem
  useEffect(() => {
    if (!selectedConversation || messages.length === 0) return;
    
    // Sempre fazer scroll no carregamento inicial da conversa
    if (isInitialLoadRef.current) {
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          console.log('📜 Scroll inicial para última mensagem');
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          isInitialLoadRef.current = false;
          lastMessageLengthRef.current = messages.length;
        }
      }, 150);
      return () => clearTimeout(timer);
    }
    
    // ✅ Auto-scroll APENAS se uma NOVA mensagem foi adicionada (não substituída)
    const lengthChanged = messages.length !== lastMessageLengthRef.current;
    
    if (shouldAutoScroll && lengthChanged) {
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          console.log('📜 Auto-scroll para nova mensagem');
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      lastMessageLengthRef.current = messages.length;
      return () => clearTimeout(timer);
    }
    
    // ✅ Atualizar a ref mesmo sem scroll para manter sincronizado
    lastMessageLengthRef.current = messages.length;
  }, [selectedConversation?.id, messages.length, shouldAutoScroll]);


  // ✅ CORREÇÃO: Listener ESC para voltar da conversa
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedConversation) {
        handleBackToList();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedConversation]);

  // ✅ CORREÇÃO: Função para voltar à lista de conversas
  const handleBackToList = () => {
    setSelectedConversation(null);
    clearMessages();
    
    // Limpar URL params
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url.toString());
  };

  return <div className="flex h-full bg-white overflow-hidden w-full">
      {/* Sidebar de Filtros */}
      {(!onlyMessages) && (
      <div className={cn("border-r border-border flex flex-col transition-all duration-300 bg-background", sidebarCollapsed ? "w-14" : "w-40 lg:w-48")}>
        {/* Header da sidebar */}
        <div className="p-3 border-b border-border flex items-center justify-between bg-white">
          {!sidebarCollapsed && <h2 className="text-sm font-semibold">Conversas</h2>}
          <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="h-8 w-8">
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Select de Canais */}
        {!sidebarCollapsed && <div className="p-3 border-b border-border bg-white">
            <Select value={selectedConnection || "all"} onValueChange={value => setSelectedConnection(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder="Todas as conexões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as conexões</SelectItem>
                {connectionsLoading ? <SelectItem value="__loading__" disabled>Carregando...</SelectItem> : workspaceConnections.length === 0 ? <SelectItem value="__empty__" disabled>Nenhuma conexão</SelectItem> : workspaceConnections.map(connection => <SelectItem key={connection.id} value={connection.id}>
                      {connection.instance_name}
                    </SelectItem>)}
              </SelectContent>
            </Select>
          </div>}

        {/* Categorias de Navegação */}
        <nav className="flex-1 pr-2 pt-2 pb-2 pl-1 bg-white">
          <div className="space-y-1">
            {/* Todos */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setActiveTab('all')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm bg-white", activeTab === 'all' ? "text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Circle className={cn("h-4 w-4", activeTab === 'all' && "fill-primary text-primary")} />
                    {!sidebarCollapsed && <>
                        <span className="flex-1 text-left">Todos</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">
                          {conversations.filter(c => c.status !== 'closed').length}
                        </span>
                      </>}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && <TooltipContent side="right">Todos</TooltipContent>}
              </Tooltip>
            </TooltipProvider>

            {/* Minhas Conversas */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setActiveTab('mine')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm bg-white", activeTab === 'mine' ? "text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <UserCircle className="h-4 w-4" />
                    {!sidebarCollapsed && <>
                        <span className="flex-1 text-left">Minhas conversas</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">
                          {conversations.filter(c => c.assigned_user_id === user?.id && c.status !== 'closed').length}
                        </span>
                      </>}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && <TooltipContent side="right">Minhas conversas</TooltipContent>}
              </Tooltip>
            </TooltipProvider>

            {/* Não atribuídas */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setActiveTab('unassigned')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm bg-white", activeTab === 'unassigned' ? "text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <UserX className="h-4 w-4" />
                    {!sidebarCollapsed && <>
                        <span className="flex-1 text-left">Não atribuídas</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">
                          {conversations.filter(c => !c.assigned_user_id && c.status !== 'closed').length}
                        </span>
                      </>}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && <TooltipContent side="right">Não atribuídas</TooltipContent>}
              </Tooltip>
            </TooltipProvider>

            {/* Não Lidas */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setActiveTab('unread')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm bg-white", activeTab === 'unread' ? "text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <MessageCircle className="h-4 w-4" />
                    {!sidebarCollapsed && <>
                        <span className="flex-1 text-left">Não lidas</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">
                          {conversations.filter(c => conversationNotifications.has(c.id) && c.status !== 'closed').length}
                        </span>
                      </>}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && <TooltipContent side="right">Não lidas</TooltipContent>}
              </Tooltip>
            </TooltipProvider>

            {/* Grupos */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setActiveTab('groups')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm bg-white", activeTab === 'groups' ? "text-primary font-medium border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <UsersRound className="h-4 w-4" />
                    {!sidebarCollapsed && <>
                        <span className="flex-1 text-left">Grupos</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">
                          0
                        </span>
                      </>}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && <TooltipContent side="right">Grupos</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          </div>
            </nav>

            {/* Seção Customizado */}
        {!sidebarCollapsed && <div className="border-t border-border p-2">
            <Collapsible open={customFiltersOpen} onOpenChange={setCustomFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-9 px-3 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span>Customizado</span>
                  </div>
                  <Plus className={cn("h-4 w-4 transition-transform", customFiltersOpen && "rotate-45")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {/* Filtro por Tag */}
                <div className="px-2">
                  <Select value={selectedTag || "all"} onValueChange={value => setSelectedTag(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Filtrar por tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {tags.map(tag => <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{
                        backgroundColor: tag.color || '#808080'
                      }} />
                            <span className="text-xs">{tag.name}</span>
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Botão Limpar */}
                {selectedTag && <div className="px-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => {
                setSelectedTag("");
              }} className="w-full h-7 text-xs">
                      Limpar filtros
                    </Button>
                  </div>}
              </CollapsibleContent>
            </Collapsible>
          </div>}
      </div>
      )}

      {/* Sidebar com lista de conversas */}
      {(!onlyMessages) && (
      <div className="w-full md:w-72 lg:w-72 md:min-w-72 lg:min-w-72 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input placeholder="Buscar" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-3 border-0 shadow-none bg-muted/30" />
            </div>
            
            {/* Botão de atualizar */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={async () => {
                      console.log('🔄 Recarregando conversas manualmente...');
                      await fetchConversations();
                    }}
                    disabled={loading}
                    className="h-9 w-9 shrink-0"
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Atualizar conversas</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Lista de conversas */}
        <ScrollArea className="flex-1">
          {loading ? (
            <WhatsAppChatSkeleton />
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-3">
                <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                <p className="text-xs text-muted-foreground">Configure conexões WhatsApp para ver conversas</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0 group/list flex flex-col">
              {filteredConversations.map(conversation => {
                // ✅ Removido lastMessage (lazy loading)
                const lastActivity = getActivityDisplay(conversation);
                const initials = getInitials(conversation.contact?.name || conversation.contact?.phone || 'U');
                const avatarColor = getAvatarColor(conversation.contact?.name || conversation.contact?.phone || 'U');
                // ✅ CRÍTICO: Key dinâmica para forçar re-render do card quando conversa atualizar
                const cardKey = `${conversation.id}-${conversation._updated_at || 0}-${conversation.last_activity_at}`;
                return (
                  <li key={cardKey} className="list-none">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className={cn("relative flex items-center px-4 py-2 cursor-pointer rounded-lg transition-all duration-300 ease-in-out border-b border-border/50", "group-hover/list:opacity-30 hover:!opacity-100 hover:shadow-lg hover:scale-[1.02] hover:translate-x-1 hover:bg-white hover:z-10", selectedConversation?.id === conversation.id && "bg-muted !opacity-100")} onClick={() => handleSelectConversation(conversation)} role="button" tabIndex={0}>
                  {/* Status indicator bar - cor da conexão */}
                  {/* Barra de status/identificação da conexão com tooltip detalhado */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="absolute left-0 top-0 bottom-0 w-1 rounded-r" style={{
                    backgroundColor: (() => {
                      // Se tem conexão, usa cor da conexão (salva ou gerada por hash)
                      if (conversation.connection) {
                        return getConnectionColor(
                          conversation.connection.id, 
                          conversation.connection.metadata
                        );
                      }
                      // Senão, usa lógica do agente
                      return conversation.agente_ativo ? 'rgb(83, 0, 235)' : 'rgb(76, 175, 80)';
                    })()
                  }} />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      {conversation.connection ? (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">{conversation.connection.instance_name || 'Instância'}</p>
                          {conversation.connection.phone_number && (
                            <p className="text-xs text-muted-foreground">{conversation.connection.phone_number}</p>
                          )}
                          <p className="text-[10px] mt-1">
                            {(() => {
                              const status = (conversation.connection.status || '').toLowerCase();
                              switch (status) {
                                case 'open':
                                case 'connected':
                                  return 'Status: Conectado';
                                case 'creating':
                                  return 'Status: Criando';
                                case 'connecting':
                                  return 'Status: Conectando';
                                case 'closed':
                                case 'disconnected':
                                  return 'Status: Desconectado';
                                default:
                                  return `Status: ${conversation.connection.status || 'N/A'}`;
                              }
                            })()}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">{conversation.agente_ativo ? 'DS AGENTE' : 'ATIVO'}</p>
                          <p className="text-[10px] text-muted-foreground">Sem conexão vinculada</p>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                    
                    {/* Avatar container */}
                    <div className="flex-shrink-0 mr-3 ml-2">
                      <div className="relative">
                        <div className="relative w-10 h-10">
                          <Avatar className="h-10 w-10">
                            {conversation.contact?.profile_image_url && <AvatarImage src={conversation.contact.profile_image_url} alt={conversation.contact?.name || conversation.contact?.phone} className="object-cover" />}
                            <AvatarFallback className="text-white font-medium text-sm" style={{
                              backgroundColor: avatarColor
                            }}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          
                          {/* Badge de mensagens não lidas - baseado em notificações */}
                          {conversationNotifications.has(conversation.id) && (
                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                              <span className="text-white text-xs font-semibold">
                                {conversationNotifications.get(conversation.id)! > 99 ? '99+' : conversationNotifications.get(conversation.id)}
                              </span>
                            </div>
                          )}
                          
                          {/* WhatsApp status icon */}
                          <svg className="absolute -bottom-1 -right-1 w-5 h-5 text-green-500 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.26h.47c.15 0 .36-.06.55.45l.69 1.87c.06.13.1.28.01.44l-.27.41-.39.42c-.12.12-.26.25-.12.5.12.26.62 1.09 1.32 1.78.91.88 1.71 1.17 1.95 1.3.24.14.39.12.54-.04l.81-.94c.19-.25.35-.19.58-.11l1.67.88M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-1.97 0-3.8-.57-5.35-1.55L2 22l1.55-4.65A9.969 9.969 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8c0 1.72.54 3.31 1.46 4.61L4.5 19.5l2.89-.96A7.95 7.95 0 0 0 12 20a8 8 0 0 0 8-8 8 8 0 0 0-8-8z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                     {/* Main content */}
                    <div className="flex-1 min-w-0">
                       {/* First line: Name with connection badge */}
                       <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                        <span className="text-xs font-normal text-foreground tracking-tight truncate whitespace-nowrap overflow-hidden text-ellipsis block" style={{
                          fontWeight: 400,
                          letterSpacing: '-0.2px',
                          fontSize: '12px'
                        }}>
                          {conversation.contact?.name || conversation.contact?.phone}
                        </span>
                          <ConnectionBadge 
                            connectionId={conversation.connection_id}
                            connectionInfo={conversation.connection}
                          />
                      </div>
                      
                        {/* ✅ Última mensagem da conversa */}
                      <div className="flex items-center min-w-0">
                        <span className={cn(
                          "text-foreground/87 truncate whitespace-nowrap overflow-hidden text-ellipsis block",
                          conversationNotifications.has(conversation.id) && "font-bold text-foreground"
                        )} style={{
                          fontSize: '11px',
                          fontWeight: conversationNotifications.has(conversation.id) ? 600 : 400,
                          letterSpacing: '0px'
                        }}>
                          {conversation.last_message?.[0] ? <>
                              {conversation.last_message[0].sender_type === 'contact' ? '' : 'Você: '}
                              {conversation.last_message[0].message_type === 'text' ? conversation.last_message[0].content : `${conversation.last_message[0].message_type === 'image' ? '📷' : conversation.last_message[0].message_type === 'video' ? '🎥' : conversation.last_message[0].message_type === 'audio' ? '🎵' : '📄'} ${conversation.last_message[0].message_type.charAt(0).toUpperCase() + conversation.last_message[0].message_type.slice(1)}`}
                            </> : conversationNotifications.has(conversation.id) ? `${conversationNotifications.get(conversation.id)} mensagem${conversationNotifications.get(conversation.id)! > 1 ? 's' : ''} não lida${conversationNotifications.get(conversation.id)! > 1 ? 's' : ''}` : 'Clique para ver mensagens'}
                        </span>
                      </div>
                    </div>
                    
                {/* Secondary actions */}
                <div className="flex flex-col items-end gap-1 ml-2">
                  {/* Timestamp - ACIMA */}
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">
                      {lastActivity}
                    </span>
                  </div>
                  
                  {/* Tag/Label system + Avatar */}
                  <div className="flex items-center gap-2">
                    {/* Tags */}
                    {conversation.tags && conversation.tags.length > 0 && <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              {conversation.tags.slice(0, 2).map((tag: any) => <Badge key={tag.id} variant="outline" className="text-[10px] px-1 py-0 h-4" style={{
                                  borderColor: tag.color || '#8B5CF6',
                                  color: tag.color || '#8B5CF6'
                                }}>
                                  {tag.name}
                                </Badge>)}
                              {conversation.tags.length > 2 && <span className="text-[10px] text-muted-foreground">
                                  +{conversation.tags.length - 2}
                                </span>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              {conversation.tags.map((tag: any) => <div key={tag.id} className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{
                                    backgroundColor: tag.color || '#8B5CF6'
                                  }} />
                                  <span>{tag.name}</span>
                                </div>)}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>}
                    
                    {/* Avatar do usuário atribuído */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                            <Avatar className="w-6 h-6 rounded-full">
                              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                                {conversation.assigned_user_name ? conversation.assigned_user_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                              </AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{conversation.assigned_user_name?.split(' ')[0] || 'Não atribuído'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={e => {
                    e.stopPropagation();
                    setPeekConversationId(conversation.id);
                    setPeekModalOpen(true);
                  }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Espiar
                      </ContextMenuItem>
                    </ContextMenuContent>
                    </ContextMenu>
                  </li>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Campo para nova conversa */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-0 border rounded-md overflow-hidden">
              {/* Prefixo fixo +55 */}
              <div className="flex items-center bg-muted px-3 border-r">
                <span className="text-sm font-medium text-muted-foreground">+55</span>
              </div>
              
              {/* Input do número */}
              <div className="relative flex-1">
                <Input placeholder="21999999999" value={quickPhoneNumber} onChange={e => setQuickPhoneNumber(e.target.value.replace(/\D/g, ''))} onKeyPress={handleQuickConversationKeyPress} className="border-0 focus-visible:ring-0 pr-10" disabled={isCreatingQuickConversation} maxLength={11} />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8" disabled={!quickPhoneNumber.trim() || isCreatingQuickConversation} onClick={handleCreateQuickConversation}>
                  {isCreatingQuickConversation ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Área principal de chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? <>
            {/* Cabeçalho do chat */}
            <div className="p-4 border-b border-border bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!onlyMessages && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleBackToList}
                          className="h-9 w-9 hover:bg-muted"
                        >
                          <ArrowRight className="h-5 w-5 rotate-180" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Voltar à lista (ESC)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  )}

                   <Avatar className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all" onClick={() => setContactPanelOpen(true)}>
                    {selectedConversation.contact?.profile_image_url && <AvatarImage src={selectedConversation.contact.profile_image_url} alt={selectedConversation.contact?.name} className="object-cover" />}
                    <AvatarFallback style={{
                  backgroundColor: getAvatarColor(selectedConversation.contact?.name || '')
                }} className="text-white">
                      {getInitials(selectedConversation.contact?.name || '')}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 text-base">
                      {selectedConversation.contact?.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <ContactTags contactId={selectedConversation.contact.id} isDarkMode={isDarkMode} onTagRemoved={() => {
                    // Refresh conversations after removing tag
                    fetchConversations();
                  }} />
                      <AddTagButton conversationId={selectedConversation.id} isDarkMode={isDarkMode} onTagAdded={() => {
                    // Refresh conversations after adding tag
                    fetchConversations();
                  }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  {/* Botão do agente */}
                  <div className="flex items-center gap-2">
                    {selectedConversation.agente_ativo && agent ? (
                      <button
                        onClick={() => setChangeAgentModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-full shadow-sm hover:shadow-md transition-all hover:border-green-300 group"
                        title="Agente ativo - clique para trocar"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
                          <Bot className="w-3.5 h-3.5 text-green-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-xs font-semibold text-green-700 leading-none">
                          {agent.name}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setChangeAgentModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all hover:border-green-300 hover:from-green-50 hover:to-emerald-50 group"
                        title="Clique para ativar um agente"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-gray-400 rounded-full group-hover:bg-green-500 transition-colors" />
                          <Bot className="w-3.5 h-3.5 text-gray-600 group-hover:text-green-600 group-hover:scale-110 transition-all" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-green-700 leading-none transition-colors">
                          Ativar
                        </span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => setAssignmentHistoryModalOpen(true)}
                      className="p-2 hover:bg-accent rounded-full transition-colors"
                      title="Ver histórico de agentes e transferências"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  
                  {selectedConversation.connection_id && (
                    <ConnectionBadge 
                      connectionId={selectedConversation.connection_id}
                      connectionInfo={selectedConversation.connection}
                    />
                  )}
                  
                  <AcceptConversationButton conversation={selectedConversation} onAccept={async (conversationId: string) => {
                // Get current user info for immediate UI update
                const userData = localStorage.getItem('currentUser');
                const currentUserData = userData ? JSON.parse(userData) : null;

                // Update selected conversation immediately for better UX
                if (selectedConversation && selectedConversation.id === conversationId) {
                  setSelectedConversation(prev => prev ? {
                    ...prev,
                    assigned_user_id: currentUserData?.id || null,
                    assigned_user_name: currentUserData?.name || null
                  } : prev);
                }

                // Refresh conversations to sync with server and update the list
                await fetchConversations();
              }} className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md" />
                  
                  <EndConversationButton conversation={selectedConversation} onEnd={async (conversationId: string) => {
                // Update selected conversation status immediately for better UX
                if (selectedConversation && selectedConversation.id === conversationId) {
                  setSelectedConversation(prev => prev ? {
                    ...prev,
                    status: 'closed'
                  } : prev);
                }

                // Refresh conversations to sync with server and update the list
                await fetchConversations();

                // Clear selected conversation if it was the one ended
                if (selectedConversation?.id === conversationId) {
                  setSelectedConversation(null);
                  clearMessages();
                }
              }} className="h-8 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md" />
                </div>
              </div>
            </div>

            {/* Área de mensagens */}
        <div className="flex-1 h-0 relative">
          {/* Indicador de data flutuante - FORA do ScrollArea */}
          {shouldShowFloating && floatingDate && (
            <FloatingDateIndicator date={floatingDate} visible={shouldShowFloating} />
          )}
          
          <ScrollArea 
            className="h-full px-4 py-2" 
            ref={node => {
              if (node) {
                const scrollContainer = node.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollContainer) {
                  messagesScrollRef.current = scrollContainer as HTMLElement;
                }
              }
            }}
            onScroll={handleScroll}
          >
              {/* Botão Carregar Mais Mensagens */}
              {hasMore && !loadingMore && messages.length > 0 && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('🔘 Clicou em Carregar Mais - scroll atual:', messagesScrollRef.current?.scrollTop);
                      loadMoreMessages();
                    }}
                    className="text-xs"
                  >
                    Carregar mais mensagens
                  </Button>
                </div>
              )}
              
              {/* Loading ao carregar mais mensagens */}
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                    <span className="text-sm">Carregando mensagens...</span>
                  </div>
                </div>
              )}
              
              {/* Loading inicial das mensagens */}
              {messagesLoading && messages.length === 0 && (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              )}
              
              <div className="space-y-4">
                {Array.from(messagesByDate.entries()).map(([dateKey, dateMessages]) => {
                  const firstMessage = dateMessages[0];
                  const dateLabel = formatMessageDate(firstMessage.created_at);
                  
                  return (
                    <div key={dateKey}>
                      {/* Separador de data */}
                      <DateSeparator date={dateLabel} />
                      
                      {/* Mensagens do dia */}
                      {dateMessages.map(message => {
                        const displayStatus = getDisplayMessageStatus(message);
                        const isContactMessage = message.sender_type === 'contact';
                        const senderDisplayName = getSenderDisplayName(
                          message.sender_type,
                          selectedConversation.contact?.name || ''
                        );

                        return (
                          <div 
                            key={message.id} 
                            data-message-id={message.id} 
                            className={cn(
                              "flex items-start gap-3 max-w-[80%] relative mb-3",
                              isContactMessage ? "flex-row" : "flex-row-reverse ml-auto",
                              selectionMode && "cursor-pointer",
                              selectedMessages.has(message.id) && "bg-gray-200 dark:bg-gray-700/50 rounded-lg"
                            )}
                            onClick={() => selectionMode && toggleMessageSelection(message.id)}
                          >
                    {isContactMessage && <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all" onClick={() => setContactPanelOpen(true)}>
                        {selectedConversation.contact?.profile_image_url && <AvatarImage src={selectedConversation.contact.profile_image_url} alt={selectedConversation.contact?.name} className="object-cover" />}
                        <AvatarFallback className={cn("text-white text-xs", getAvatarColor(selectedConversation.contact?.name || ''))}>
                          {getInitials(selectedConversation.contact?.name || '')}
                        </AvatarFallback>
                      </Avatar>}
                     
                     <div className={cn(
                       "max-w-full group relative",
                       message.message_type === 'audio' ? "" : "rounded-lg",
                       // Mensagens de contato
                       isContactMessage 
                         ? message.message_type === 'audio' 
                           ? "" 
                           : message.message_type === 'image' || message.message_type === 'video' 
                             ? "bg-transparent" 
                             : "bg-muted px-2 py-1.5"
                       // Mensagens do agente
                       : message.sender_type === 'ia'
                         ? message.message_type === 'audio'
                           ? ""
                           : message.message_type === 'image' || message.message_type === 'video'
                             ? "bg-transparent"
                             : "bg-green-50 dark:bg-green-950/20 px-2 py-1.5"
                       // Mensagens normais do agente
                       : message.message_type !== 'text' && message.file_url 
                         ? message.message_type === 'audio' 
                           ? "" 
                           : message.message_type === 'image' || message.message_type === 'video' 
                             ? "bg-transparent" 
                             : "bg-primary px-2 py-1.5" 
                         : "bg-primary text-primary-foreground px-2 py-1.5"
                     )}>
                      {/* Menu de contexto */}
                      {!selectionMode && <MessageContextMenu onForward={() => handleMessageForward(message.id)} onReply={() => handleReply(message)} onDownload={message.file_url ? () => {
                  const link = document.createElement('a');
                  link.href = message.file_url!;
                  link.download = message.file_name || 'download';
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } : undefined} hasDownload={!!message.file_url} />}
                      
                      {/* Mostrar mensagem quotada se existir */}
                      {message.quoted_message && message.reply_to_message_id && (
                        <QuotedMessagePreview
                          quotedMessage={message.quoted_message}
                          senderName={getSenderDisplayName(
                            message.quoted_message.sender_type,
                            selectedConversation.contact?.name || ''
                          )}
                          onQuoteClick={() => scrollToMessage(message.reply_to_message_id!)}
                        />
                      )}

                      {/* Renderizar conteúdo baseado no tipo */}
                      {message.message_type !== 'text' && message.file_url ? (
                        <MediaViewer
                          fileUrl={message.file_url}
                          fileName={message.file_name}
                          messageType={message.message_type}
                          className="max-w-xs"
                          senderType={message.sender_type}
                          senderAvatar={isContactMessage ? selectedConversation.contact?.profile_image_url : undefined}
                          senderName={senderDisplayName}
                          messageStatus={displayStatus}
                          timestamp={message.created_at}
                        />
                      ) : (
                        <div className="flex items-end justify-between gap-2 min-w-0">
                    <p className={cn(
                      "text-sm break-words flex-1",
                      message.sender_type === 'ia' && "text-green-900 dark:text-green-100"
                    )}>{message.content}</p>
                    
                    <div className="flex items-center gap-1 flex-shrink-0 self-end" style={{ fontSize: '11px' }}>
                      <span className={cn(
                        isContactMessage 
                          ? "text-muted-foreground"
                          : message.sender_type === 'ia'
                            ? "text-green-700 dark:text-green-300"
                            : "text-primary-foreground/70"
                      )}>
                        {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {displayStatus && (
                        <>
                          {console.log('📊 [RENDER] MessageStatusIndicator:', {
                            messageId: message.id,
                            displayStatus,
                            timestamp: new Date().toISOString()
                          })}
                          <MessageStatusIndicator 
                            status={displayStatus} 
                          />
                        </>
                      )}
                    </div>
                  </div>
                      )}
                    </div>
                  </div>
                        );
                      })}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

            {/* Reply Preview */}
            {replyingTo && (
              <ReplyPreview
                message={replyingTo}
                contactName={selectedConversation.contact?.name || ''}
                onCancel={() => setReplyingTo(null)}
              />
            )}

            {/* Campo de entrada de mensagem */}
            <div className="p-4 border-t border-border relative">
              {isRecording ? <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Gravando...
                    </span>
                  </div>
                  
                  <div className="flex-1 text-center">
                    <span className="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                      {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                      {String(recordingTime % 60).padStart(2, '0')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button onClick={cancelRecording} size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50" title="Cancelar gravação">
                      <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </Button>
                    
                    <Button onClick={stopRecording} size="icon" className="h-10 w-10 rounded-full bg-green-500 hover:bg-green-600" title="Enviar áudio">
                      <Check className="w-5 h-5 text-white" />
                    </Button>
                  </div>
                </div> : <div className="flex items-end gap-2">
                  <MediaUpload onFileSelect={async (file, mediaType, fileUrl, caption) => {
              if (!selectedConversation) return;
              
              // MUTEX: Prevenir duplicação baseado na URL do arquivo
              const messageKey = `media-${selectedConversation.id}-${fileUrl}`;
              if (sendingRef.current.has(messageKey)) {
                console.log('⏭️ Ignorando envio duplicado de mídia');
                return;
              }
              sendingRef.current.add(messageKey);
              
              // Usar UUID único para prevenir duplicação
              const clientMessageId = crypto.randomUUID();
              
              const optimisticMessage = {
                id: clientMessageId,
                external_id: clientMessageId,
                conversation_id: selectedConversation.id,
                content: caption || '', // Caption do modal ou vazio
                message_type: mediaType as any,
                sender_type: 'agent' as const,
                sender_id: user?.id,
                file_url: fileUrl,
                file_name: file.name,
                mime_type: file.type,
                created_at: new Date().toISOString(),
                status: 'sending' as const,
                workspace_id: selectedWorkspace?.workspace_id || ''
              };
              
              addMessage(optimisticMessage);
              
              try {
                const {
                  data: sendResult,
                  error
                } = await supabase.functions.invoke('test-send-msg', {
                  body: {
                    conversation_id: selectedConversation.id,
                    content: caption || '', // Caption do modal
                    message_type: mediaType,
                    sender_id: user?.id,
                    sender_type: 'agent',
                    file_url: fileUrl,
                    file_name: file.name,
                    mime_type: file.type,
                    clientMessageId: clientMessageId
                  },
                  headers: {
                    'x-system-user-id': user?.id || '',
                    'x-workspace-id': selectedWorkspace?.workspace_id || '',
                    'x-system-user-email': user?.email || ''
                  }
                });
                
                if (error) {
                  console.error('Erro ao enviar mídia:', error);
                  toast({
                    title: "Erro ao enviar mídia",
                    description: error.message || "Erro desconhecido",
                    variant: "destructive"
                  });
                  updateMessage(optimisticMessage.id, {
                    status: 'failed',
                    content: `❌ ${optimisticMessage.content}`
                  });
                } else {
                  console.log('✅ Mídia enviada com sucesso:', sendResult);
                  // Atualizar external_id para corresponder à mensagem real que virá do Realtime
                  if (sendResult.external_id) {
                    updateMessage(clientMessageId, {
                      external_id: sendResult.external_id
                    });
                  }
                }
              } catch (err) {
                console.error('Erro ao enviar mídia:', err);
                toast({
                  title: "Erro ao enviar mídia",
                  description: "Erro de conexão",
                  variant: "destructive"
                });
                updateMessage(optimisticMessage.id, {
                  status: 'failed',
                  content: `❌ ${optimisticMessage.content}`
                });
              } finally {
                // Remover do MUTEX após 1 segundo
                setTimeout(() => sendingRef.current.delete(messageKey), 1000);
              }
            }} />
                  
                  <Button variant="ghost" size="sm" title="Mensagens Rápidas" onClick={() => setQuickItemsModalOpen(true)}>
                    <svg className="w-4 h-4" focusable="false" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                      <circle cx="9" cy="9" r="4"></circle>
                      <path d="M9 15c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7.76-9.64l-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z"></path>
                    </svg>
                  </Button>
                  <div className="flex-1">
                    <Input 
                      placeholder="Digite sua mensagem..." 
                      value={messageText} 
                      onChange={e => setMessageText(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }} 
                      className="resize-none" 
                    />
                  </div>
                  <Button onClick={startRecording} size="icon" variant="secondary" title="Gravar áudio">
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleSendMessage} disabled={!messageText.trim() || isSending} size="icon">
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>}

              {/* Barra de seleção (modo de encaminhamento) */}
              {selectionMode && <MessageSelectionBar selectedCount={selectedMessages.size} onCancel={cancelSelection} onForward={() => setForwardModalOpen(true)} />}
            </div>
          </> : <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-muted-foreground">
                Escolha uma conversa da lista para começar a conversar
              </p>
            </div>
          </div>}
        
        <PeekConversationModal isOpen={peekModalOpen} onClose={() => {
        setPeekModalOpen(false);
        setPeekConversationId(null);
      }} conversationId={peekConversationId} />
      
      <ContactSidePanel isOpen={contactPanelOpen} onClose={() => setContactPanelOpen(false)} contact={selectedConversation?.contact || null} />
      
      <QuickItemsModal open={quickItemsModalOpen} onOpenChange={setQuickItemsModalOpen} onSendMessage={handleSendQuickMessage} onSendAudio={handleSendQuickAudio} onSendMedia={handleSendQuickMedia} onSendDocument={handleSendQuickDocument} />
      
      <ForwardMessageModal isOpen={forwardModalOpen} onClose={() => setForwardModalOpen(false)} onForward={handleForwardMessages} />
      
      <SelectAgentModal 
        open={showSelectAgentModal} 
        onOpenChange={setShowSelectAgentModal} 
        conversationId={selectedConversation?.id || ''} 
      />

      <ChangeAgentModal
        open={changeAgentModalOpen}
        onOpenChange={setChangeAgentModalOpen}
        conversationId={selectedConversation?.id || ''}
        currentAgentId={selectedConversation?.agent_active_id}
        onAgentChanged={async () => {
          console.log('🔄 Agente alterado, atualizando conversa...');
          // Recarregar conversas para atualizar a lista
          await fetchConversations();
        }}
      />

      <AssignmentHistoryModal
        isOpen={assignmentHistoryModalOpen}
        onOpenChange={setAssignmentHistoryModalOpen}
        conversationId={selectedConversation?.id || ''}
      />
      </div>

      {/* ✅ Listener para recarregar mensagens quando a página fica visível novamente */}
      {(() => {
        useEffect(() => {
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && selectedConversation?.id) {
              console.log('👁️ [WhatsAppChat] Página visível, recarregando mensagens:', selectedConversation.id);
              loadMessages(selectedConversation.id, true); // ✅ Forçar refresh
            }
          };

          document.addEventListener('visibilitychange', handleVisibilityChange);
          return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }, [selectedConversation?.id]);

        return null;
      })()}
    </div>;
}