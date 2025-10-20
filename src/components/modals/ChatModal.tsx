import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Mic, Plus, Bot, X, Square, Check } from 'lucide-react';
import { AudioPlayer } from '@/components/chat/AudioPlayer';
import { MediaViewer } from '@/components/chat/MediaViewer';
import { AddTagButton } from '@/components/chat/AddTagButton';
import { ContactTags } from '@/components/chat/ContactTags';
import { MediaUpload } from '@/components/chat/MediaUpload';
import { QuickItemsModal } from '@/components/modals/QuickItemsModal';
import { MessageStatusIndicator } from '@/components/ui/message-status-indicator';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { MessageSelectionBar } from '@/components/chat/MessageSelectionBar';
import { ForwardMessageModal } from '@/components/modals/ForwardMessageModal';
import { AcceptConversationButton } from '@/components/chat/AcceptConversationButton';
import { EndConversationButton } from '@/components/chat/EndConversationButton';
import { ContactSidePanel } from '@/components/ContactSidePanel';
import { ReplyPreview } from '@/components/chat/ReplyPreview';
import { QuotedMessagePreview } from '@/components/chat/QuotedMessagePreview';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useConversationAccept } from '@/hooks/useConversationAccept';
import { useConversationEnd } from '@/hooks/useConversationEnd';
import { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/lib/avatarUtils';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  contactName: string;
  contactPhone?: string;
  contactAvatar?: string;
  contactId?: string;
}

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
  external_id?: string;
  evolution_key_id?: string;
  metadata?: any;
  workspace_id?: string;
  delivered_at?: string | null;
  read_at?: string | null;
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

// Mapear status do Evolution para status do componente
const mapEvolutionStatusToComponent = (status?: string): 'sending' | 'sent' | 'delivered' | 'read' | 'failed' => {
  if (!status) return 'sending';
  
  const statusMap: Record<string, 'sending' | 'sent' | 'delivered' | 'read' | 'failed'> = {
    'PENDING': 'sending',
    'SERVER_ACK': 'sent',
    'DELIVERY_ACK': 'delivered', 
    'READ': 'read',
    'PLAYED': 'read',
    'ERROR': 'failed',
    'sending': 'sending',
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed'
  };
  
  return statusMap[status] || 'sent';
};

export function ChatModal({ 
  isOpen, 
  onClose, 
  conversationId, 
  contactName, 
  contactPhone, 
  contactAvatar,
  contactId 
}: ChatModalProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [realContactId, setRealContactId] = useState<string | null>(contactId || null);
  const [quickItemsModalOpen, setQuickItemsModalOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [fullConversation, setFullConversation] = useState<WhatsAppConversation | null>(null);
  const [replyingTo, setReplyingTo] = useState<WhatsAppMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  
  // ✅ MUTEX: Prevenir envio duplicado (IGUAL ao WhatsAppChat)
  const sendingRef = useRef<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  
  // Usar o hook existente para buscar mensagens (COM TODAS AS FUNÇÕES)
  const { 
    messages, 
    loading, 
    loadInitial, 
    loadMore, 
    loadingMore, 
    hasMore,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages
  } = useConversationMessages();

  // Usar contactId da prop ou buscar do workspace_id das mensagens
  useEffect(() => {
    if (contactId) {
      setRealContactId(contactId);
    }
  }, [contactId]);

  // Carregar mensagens quando abrir o modal
  useEffect(() => {
    if (isOpen && conversationId && conversationId !== '') {
      console.log('🔄 ChatModal: Carregando mensagens para conversationId:', conversationId);
      console.log('📋 ChatModal: Contato:', { contactName, contactPhone });
      loadInitial(conversationId);
    } else if (isOpen) {
      console.warn('⚠️ ChatModal aberto mas conversationId inválido:', conversationId);
    } else if (!isOpen) {
      // Cleanup ao fechar modal
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingTime(0);
      }
    }
  }, [isOpen, conversationId, loadInitial, isRecording]);

  // Debug das mensagens carregadas
  useEffect(() => {
    console.log('📨 ChatModal: Mensagens carregadas:', messages?.length || 0, messages);
  }, [messages]);

  // ✅ Enviar mensagem EXATAMENTE como WhatsAppChat
  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;
    
    // ✅ PROTEÇÃO 1: Verificar se já está enviando
    if (isSending) {
      console.log('⏭️ Ignorando envio - já está enviando');
      return;
    }
    
    // ✅ PROTEÇÃO 2: MUTEX com chave idempotente
    const messageKey = `${conversationId}-${newMessage.trim()}`;
    if (sendingRef.current.has(messageKey)) {
      console.log('⏭️ Ignorando envio duplicado (MUTEX)');
      return;
    }
    
    // ✅ Marcar como "enviando" ANTES do try
    setIsSending(true);
    sendingRef.current.add(messageKey);
    
    // ✅ CRÍTICO: Salvar texto e limpar input IMEDIATAMENTE
    const textToSend = newMessage.trim();
    setNewMessage('');
    
    try {
      // ✅ Gerar clientMessageId único
      const clientMessageId = crypto.randomUUID();
      
      // ✅ Criar mensagem otimista
      const optimisticMessage = {
        id: clientMessageId,
        external_id: clientMessageId,
        conversation_id: conversationId,
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
            external_id: replyingTo.external_id || replyingTo.evolution_key_id
          }
        })
      };
      addMessage(optimisticMessage);
      
      const { data: sendResult, error } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: conversationId,
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
              external_id: replyingTo.external_id || replyingTo.evolution_key_id
            }
          })
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      
      if (error || !sendResult?.success) {
        throw new Error(sendResult?.error || 'Erro ao enviar mensagem');
      }

      console.log('✅ [sendMessage] Mensagem enviada com sucesso:', {
        clientMessageId,
        backendMessageId: sendResult.message?.id,
        optimisticId: optimisticMessage.id
      });

      // ✅ Atualizar status para 'sent'
      if (sendResult.success) {
        updateMessage(clientMessageId, { status: 'sent' });
        setReplyingTo(null); // Limpar reply após envio bem-sucedido
        console.log('✅ Mensagem marcada como "sent":', { clientMessageId });
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
      // ✅ CRÍTICO: Remover do MUTEX após 1 segundo
      setTimeout(() => {
        sendingRef.current.delete(messageKey);
      }, 1000);
    }
  };

  // Gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Iniciar timer
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      toast({
        title: "Erro ao gravar áudio",
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
        description: "O áudio não foi enviado",
      });
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        mediaRecorderRef.current!.stream.getTracks().forEach(track => track.stop());
        
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        
        await sendAudioMessage(audioBlob);
        
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
        
        resolve();
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!conversationId) return;
    
    try {
      // Upload para storage primeiro
      const fileExt = 'webm';
      const fileName = `audio_${Date.now()}.${fileExt}`;
      const filePath = `messages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      // Enviar áudio via test-send-msg com URL
      const { data, error } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: conversationId,
          content: '[AUDIO]',
          message_type: 'audio',
          sender_type: 'agent',
          file_url: publicUrl,
          file_name: fileName
        }
      });

      if (error) throw error;

      loadInitial(conversationId);
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast({
        title: "Erro ao enviar áudio",
        description: "Não foi possível enviar o áudio. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Handlers para itens rápidos
  const handleSendQuickMessage = async (content: string, type: 'text') => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: conversationId,
          content: content,
          message_type: type,
          sender_type: 'agent'
        }
      });

      if (error) throw error;

      loadInitial(conversationId);
      setQuickItemsModalOpen(false);
    } catch (error) {
      console.error('Erro ao enviar mensagem rápida:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };

  const handleSendQuickAudio = async (file: { name: string; url: string }, content: string) => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: conversationId,
          content: content || '[ÁUDIO]',
          message_type: 'audio',
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name
        }
      });

      if (error) throw error;

      loadInitial(conversationId);
      setQuickItemsModalOpen(false);
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o áudio",
        variant: "destructive"
      });
    }
  };

  const handleSendQuickMedia = async (file: { name: string; url: string }, content: string, type: 'image' | 'video') => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: conversationId,
          content: content || `[${type.toUpperCase()}]`,
          message_type: type,
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name
        }
      });

      if (error) throw error;

      loadInitial(conversationId);
      setQuickItemsModalOpen(false);
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mídia",
        variant: "destructive"
      });
    }
  };

  const handleSendQuickDocument = async (file: { name: string; url: string }, content: string) => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase.functions.invoke('test-send-msg', {
        body: {
          conversation_id: conversationId,
          content: content || '[DOCUMENTO]',
          message_type: 'document',
          sender_type: 'agent',
          file_url: file.url,
          file_name: file.name
        }
      });

      if (error) throw error;

      loadInitial(conversationId);
      setQuickItemsModalOpen(false);
    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o documento",
        variant: "destructive"
      });
    }
  };

  // Scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Gerar iniciais do contato
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
  };

  // Formatar horário
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  // Buscar dados completos da conversa para botões Accept/End
  useEffect(() => {
    if (isOpen && conversationId) {
      const fetchFullConversation = async () => {
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            contact:contacts(*),
            conversation_tags(
              id,
              tag_id,
              tag:tags(id, name, color)
            )
          `)
          .eq('id', conversationId)
          .single();
        
        if (data && !error) {
          setFullConversation(data as any);
        }
      };
      
      fetchFullConversation();
    }
  }, [isOpen, conversationId]);

  // Funções para modo de seleção
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleMessageForward = (messageId: string) => {
    setSelectedMessages(new Set([messageId]));
    setForwardModalOpen(true);
  };

  const handleForwardMessages = async (targetContactIds: string[]) => {
    console.log('Encaminhar mensagens:', Array.from(selectedMessages), 'para contatos:', targetContactIds);
    // TODO: Implementar lógica de encaminhamento
    setForwardModalOpen(false);
    setSelectionMode(false);
    setSelectedMessages(new Set());
    
    toast({
      title: "Mensagens encaminhadas",
      description: "As mensagens foram encaminhadas com sucesso"
    });
  };

  const handleReply = (message: WhatsAppMessage) => {
    setReplyingTo(message);
    // Focar no input após definir a mensagem para resposta
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Digite sua mensagem..."]');
      input?.focus();
    }, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header igual ao WhatsAppChat */}
          <div className="p-4 border-b border-border bg-white">
            {/* Barra de seleção (quando em modo seleção) */}
            {selectionMode && (
              <MessageSelectionBar
                selectedCount={selectedMessages.size}
                onCancel={() => {
                  setSelectionMode(false);
                  setSelectedMessages(new Set());
                }}
                onForward={() => setForwardModalOpen(true)}
              />
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar CLICÁVEL */}
                <Avatar 
                  className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all"
                  onClick={() => setContactPanelOpen(true)}
                >
                  {contactAvatar ? (
                    <AvatarImage src={contactAvatar} alt={contactName} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(contactName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 text-base">{contactName}</h3>
                  <div className="flex items-center gap-2">
                    {realContactId && (
                      <ContactTags 
                        contactId={realContactId}
                        onTagRemoved={() => loadInitial(conversationId)}
                      />
                    )}
                    <AddTagButton 
                      conversationId={conversationId} 
                      onTagAdded={() => loadInitial(conversationId)} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Botão Agente IA - DESABILITADO por enquanto */}
                <Button 
                  variant="ghost"
                  size="sm"
                  disabled
                  className="h-8 px-3 rounded-full text-sm font-medium bg-muted text-muted-foreground"
                  title="Agente IA (em desenvolvimento)"
                >
                  <Bot className="w-4 h-4 mr-1" />
                  Agente IA
                </Button>
                
                {/* Botões Aceitar/Encerrar - COMPONENTES REAIS */}
                {fullConversation && (
                  <>
                    <AcceptConversationButton 
                      conversation={fullConversation}
                      onAccept={async (conversationId: string) => {
                        // Recarregar dados da conversa
                        loadInitial(conversationId);
                      }}
                      className="h-8 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-md"
                    />
                    
                    <EndConversationButton 
                      conversation={fullConversation}
                      onEnd={async (conversationId: string) => {
                        // Fechar modal após encerrar
                        onClose();
                      }}
                      className="h-8 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md"
                    />
                  </>
                )}
                
                {/* Botão fechar modal */}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Área de mensagens igual ao WhatsAppChat */}
          <ScrollArea className="flex-1 p-4" ref={(node) => {
            if (node) {
              const scrollContainer = node.querySelector('[data-radix-scroll-area-viewport]');
              if (scrollContainer && !messagesScrollRef.current) {
                messagesScrollRef.current = scrollContainer as HTMLElement;
              }
            }
          }}>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Carregando mensagens...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded">
                  Conversation ID: {conversationId || 'vazio'}
                </div>
                <div className="text-xs text-red-500">
                  {!conversationId ? '⚠️ ID da conversa não foi fornecido' : '✅ ID válido mas sem mensagens'}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Botão carregar mais no topo */}
                {hasMore && messages.length > 0 && (
                  <div className="flex justify-center p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={async () => {
                        // Guardar altura do scroll antes de carregar
                        if (messagesScrollRef.current) {
                          const scrollContainer = messagesScrollRef.current;
                          const scrollHeightBefore = scrollContainer.scrollHeight;
                          
                          await loadMore();
                          
                          // Após carregar, ajustar scroll para manter posição
                          setTimeout(() => {
                            if (scrollContainer) {
                              const scrollHeightAfter = scrollContainer.scrollHeight;
                              const heightDifference = scrollHeightAfter - scrollHeightBefore;
                              scrollContainer.scrollTop = heightDifference;
                            }
                          }, 50);
                        } else {
                          await loadMore();
                        }
                      }}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Carregando...' : 'Carregar mensagens anteriores'}
                    </Button>
                  </div>
                )}
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={cn(
                      "flex items-start gap-3 max-w-[80%] relative",
                      message.sender_type === 'contact' ? 'flex-row' : 'flex-row-reverse ml-auto',
                      selectionMode && "cursor-pointer",
                      selectedMessages.has(message.id) && "bg-gray-200 dark:bg-gray-700/50 rounded-lg"
                    )}
                    onClick={() => selectionMode && toggleMessageSelection(message.id)}
                  >
                    {/* Avatar apenas para mensagens do contato */}
                    {message.sender_type === 'contact' && (
                      <Avatar 
                        className="w-8 h-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all"
                        onClick={() => setContactPanelOpen(true)}
                      >
                        {contactAvatar ? (
                          <AvatarImage src={contactAvatar} alt={contactName} className="object-cover" />
                        ) : (
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {getInitials(contactName)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    )}
                    
                    {/* Conteúdo da mensagem */}
                    <div className={cn(
                      "max-w-full group relative",
                      message.message_type === 'audio' ? "" : "rounded-lg",
                      message.sender_type === 'contact' 
                        ? message.message_type === 'audio' ? "" : 
                          (message.message_type === 'image' || message.message_type === 'video') ? "bg-transparent" : 
                          "bg-muted p-3"
                        : message.message_type !== 'text' && message.file_url
                          ? message.message_type === 'audio' ? "" :
                            (message.message_type === 'image' || message.message_type === 'video') ? "bg-transparent" :
                            "bg-primary p-3"
                          : "bg-primary text-primary-foreground p-3"
                    )}>
                      {/* Menu de contexto */}
                      {!selectionMode && (
                        <MessageContextMenu
                          onForward={() => handleMessageForward(message.id)}
                          onReply={() => handleReply(message)}
                          onDownload={message.file_url ? () => {
                            const link = document.createElement('a');
                            link.href = message.file_url!;
                            link.download = message.file_name || 'download';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } : undefined}
                          hasDownload={!!message.file_url}
                        />
                      )}
                      
                      {/* Mostrar mensagem quotada se existir */}
                      {message.quoted_message && (
                        <QuotedMessagePreview
                          quotedMessage={message.quoted_message}
                          senderName={
                            message.quoted_message.sender_type === 'contact' ? contactName : 'Você'
                          }
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
                          senderAvatar={message.sender_type === 'contact' ? contactAvatar : undefined}
                          senderName={message.sender_type === 'contact' ? contactName : 'Você'}
                          messageStatus={message.sender_type !== 'contact' ? mapEvolutionStatusToComponent(message.status) : undefined}
                          timestamp={message.created_at}
                        />
                      ) : (
                        <div className="flex items-end justify-between gap-2 min-w-0">
                          <p className="text-sm break-words flex-1">{message.content}</p>
                          
                          <div className="flex items-center gap-1 flex-shrink-0 self-end" style={{ fontSize: '11px' }}>
                            <span className={cn(
                              message.sender_type === 'contact' 
                                ? "text-muted-foreground" 
                                : "text-primary-foreground/70"
                            )}>
                              {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {message.sender_type !== 'contact' && (
                              <MessageStatusIndicator 
                                status={mapEvolutionStatusToComponent(message.status)} 
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Reply Preview */}
          {replyingTo && (
            <ReplyPreview
              message={replyingTo}
              contactName={contactName}
              onCancel={() => setReplyingTo(null)}
            />
          )}

          {/* Input area funcional */}
          <div className="p-4 border-t border-border">
            {isRecording ? (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
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
                  <Button
                    onClick={cancelRecording}
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                    title="Cancelar gravação"
                  >
                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </Button>
                  
                  <Button
                    onClick={stopRecording}
                    size="icon"
                    className="h-10 w-10 rounded-full bg-green-500 hover:bg-green-600"
                    title="Enviar áudio"
                  >
                    <Check className="w-5 h-5 text-white" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                {/* Upload de mídia funcional */}
                <MediaUpload onFileSelect={async (file, mediaType, fileUrl) => {
                  if (!conversationId) return;
                  
                  try {
                    const { data, error } = await supabase.functions.invoke('test-send-msg', {
                      body: {
                        conversation_id: conversationId,
                        content: `[${mediaType.toUpperCase()}]`,
                        message_type: mediaType,
                        sender_type: 'agent',
                        file_url: fileUrl,
                        file_name: file.name
                      }
                    });

                    if (error) throw error;
                  } catch (error) {
                    console.error('Erro ao enviar arquivo:', error);
                    toast({
                      title: "Erro",
                      description: "Não foi possível enviar o arquivo",
                      variant: "destructive"
                    });
                  }
                }} />
              
              {/* Botão mensagens rápidas */}
              <Button 
                variant="ghost" 
                size="sm" 
                title="Mensagens Rápidas"
                onClick={() => setQuickItemsModalOpen(true)}
              >
                <svg className="w-4 h-4" focusable="false" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <circle cx="9" cy="9" r="4" />
                  <path d="M9 15c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7.76-9.64l-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z" />
                </svg>
              </Button>
              
              {/* Input de mensagem */}
              <div className="flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
              </div>
              
              {/* Botão gravação de áudio */}
              <Button 
                onClick={startRecording}
                size="icon"
                variant="secondary" 
                title="Gravar áudio"
              >
                <Mic className="w-4 h-4" />
              </Button>
              
              {/* Botão enviar */}
              <Button 
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Modal de itens rápidos */}
      <QuickItemsModal
        open={quickItemsModalOpen}
        onOpenChange={setQuickItemsModalOpen}
        onSendMessage={handleSendQuickMessage}
        onSendAudio={handleSendQuickAudio}
        onSendMedia={handleSendQuickMedia}
        onSendDocument={handleSendQuickDocument}
      />

      {/* ContactSidePanel */}
      <ContactSidePanel 
        isOpen={contactPanelOpen} 
        onClose={() => setContactPanelOpen(false)} 
        contact={realContactId ? {
          id: realContactId,
          name: contactName,
          phone: contactPhone || '',
          profile_image_url: contactAvatar
        } : null}
      />

      {/* ForwardMessageModal */}
      <ForwardMessageModal
        isOpen={forwardModalOpen}
        onClose={() => {
          setForwardModalOpen(false);
          setSelectedMessages(new Set());
        }}
        onForward={handleForwardMessages}
      />
    </Dialog>
  );
}