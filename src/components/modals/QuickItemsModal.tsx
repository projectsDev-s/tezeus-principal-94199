import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Music, Image, FileText, Send, Workflow } from 'lucide-react';
import { useQuickMessages } from '@/hooks/useQuickMessages';
import { useQuickAudios } from '@/hooks/useQuickAudios';
import { useQuickMedia } from '@/hooks/useQuickMedia';
import { useQuickDocuments } from '@/hooks/useQuickDocuments';
import { useQuickFunnels, Funnel } from '@/hooks/useQuickFunnels';
import { cn } from '@/lib/utils';

interface QuickItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage?: (content: string, type: 'text') => void;
  onSendAudio?: (file: { name: string; url: string }, content: string) => void;
  onSendMedia?: (file: { name: string; url: string }, content: string, type: 'image' | 'video') => void;
  onSendDocument?: (file: { name: string; url: string }, content: string) => void;
}

export function QuickItemsModal({ 
  open, 
  onOpenChange, 
  onSendMessage, 
  onSendAudio, 
  onSendMedia, 
  onSendDocument 
}: QuickItemsModalProps) {
  const [activeTab, setActiveTab] = useState('messages');
  
  const { messages, loading: messagesLoading } = useQuickMessages();
  const { audios, loading: audiosLoading } = useQuickAudios();
  const { media, loading: mediaLoading } = useQuickMedia();
  const { documents, loading: documentsLoading } = useQuickDocuments();
  const { funnels, loading: funnelsLoading } = useQuickFunnels();

  const handleSendMessage = (message: any) => {
    if (onSendMessage) {
      onSendMessage(message.content, 'text');
      onOpenChange(false);
    }
  };

  const handleSendAudio = (audio: any) => {
    if (onSendAudio) {
      onSendAudio(
        { name: audio.file_name, url: audio.file_url },
        audio.title
      );
      onOpenChange(false);
    }
  };

  const handleSendMedia = (mediaItem: any) => {
    if (onSendMedia) {
      const type = mediaItem.file_type?.startsWith('image/') ? 'image' : 'video';
      onSendMedia(
        { name: mediaItem.file_name, url: mediaItem.file_url },
        mediaItem.caption || '',
        type
      );
      onOpenChange(false);
    }
  };

  const handleSendDocument = (document: any) => {
    if (onSendDocument) {
      onSendDocument(
        { name: document.file_name, url: document.file_url },
        document.caption || ''
      );
      onOpenChange(false);
    }
  };

  const renderMessageItem = (message: any) => (
    <div key={message.id} className="flex items-center justify-between p-3 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h4 className="font-medium text-sm truncate text-foreground overflow-hidden whitespace-nowrap">{message.title}</h4>
          <p className="text-xs text-muted-foreground truncate overflow-hidden whitespace-nowrap">{message.content}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleSendMessage(message)}
        className="w-8 h-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderAudioItem = (audio: any) => (
    <div key={audio.id} className="flex items-center justify-between p-3 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h4 className="font-medium text-sm truncate text-foreground">{audio.title}</h4>
          <p className="text-xs text-muted-foreground">
            {audio.duration_seconds ? `${audio.duration_seconds}s` : 'Áudio'}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleSendAudio(audio)}
        className="w-8 h-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderMediaItem = (mediaItem: any) => (
    <div key={mediaItem.id} className="flex items-center justify-between p-3 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <Image className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h4 className="font-medium text-sm truncate text-foreground">{mediaItem.title}</h4>
          <p className="text-xs text-muted-foreground truncate">{mediaItem.file_type}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleSendMedia(mediaItem)}
        className="w-8 h-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderDocumentItem = (document: any) => (
    <div key={document.id} className="flex items-center justify-between p-3 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h4 className="font-medium text-sm truncate text-foreground">{document.title}</h4>
          <p className="text-xs text-muted-foreground truncate">{document.file_type}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleSendDocument(document)}
        className="w-8 h-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );

  const handleSendFunnel = async (funnel: Funnel) => {
    // Enviar cada etapa do funil de forma sequencial
    const orderedSteps = [...(funnel.steps || [])].sort((a, b) => a.order - b.order);
    
    console.log('🚀 [handleSendFunnel] Iniciando envio do funil:', {
      funnelId: funnel.id,
      funnelTitle: funnel.title,
      totalSteps: orderedSteps.length,
      steps: orderedSteps.map(s => ({ type: s.type, item_id: s.item_id, order: s.order }))
    });

    for (const step of orderedSteps) {
      const typeLower = (step.type || '').toLowerCase();
      
      // Normalizar tipos: aceitar tanto português (plural) quanto inglês (singular)
      // 'mensagens' -> 'message', 'audios' -> 'audio', 'midias' -> 'media', 'documentos' -> 'document'
      const normalizeType = (type: string): string => {
        const normalized = type.toLowerCase();
        if (normalized === 'mensagens') return 'message';
        if (normalized === 'audios') return 'audio';
        if (normalized === 'midias') return 'media';
        if (normalized === 'documentos') return 'document';
        return normalized;
      };
      
      const normalizedType = normalizeType(typeLower);
      
      try {
        let stepSent = false;

        // Texto/Mensagem
        if ((normalizedType === 'message' || normalizedType === 'text') && onSendMessage) {
          const msg = messages?.find((m: any) => m.id === step.item_id);
          if (msg) {
            console.log('📝 [handleSendFunnel] Enviando mensagem de texto:', {
              stepOrder: step.order,
              itemId: step.item_id,
              content: msg.content?.substring(0, 50) + '...'
            });
            await onSendMessage(msg.content, 'text');
            stepSent = true;
          } else {
            console.warn('⚠️ [handleSendFunnel] Mensagem não encontrada:', {
              stepOrder: step.order,
              itemId: step.item_id,
              availableMessages: messages?.map(m => m.id) || []
            });
          }
        }

        // Áudio
        else if ((normalizedType === 'audio' || normalizedType === 'voice') && onSendAudio) {
          const audio = audios?.find((a: any) => a.id === step.item_id);
          if (audio) {
            console.log('🎵 [handleSendFunnel] Enviando áudio:', {
              stepOrder: step.order,
              itemId: step.item_id,
              fileName: audio.file_name,
              title: audio.title
            });
            await onSendAudio({ name: audio.file_name, url: audio.file_url }, audio.title);
            stepSent = true;
          } else {
            console.warn('⚠️ [handleSendFunnel] Áudio não encontrado:', {
              stepOrder: step.order,
              itemId: step.item_id,
              availableAudios: audios?.map(a => a.id) || []
            });
          }
        }

        // Imagem/Vídeo (mídia)
        else if ((normalizedType === 'media' || normalizedType === 'image' || normalizedType === 'video') && onSendMedia) {
          const mediaItem = media?.find((m: any) => m.id === step.item_id);
          if (mediaItem) {
            const type = mediaItem.file_type?.startsWith('image/') ? 'image' : 'video';
            console.log('🖼️ [handleSendFunnel] Enviando mídia:', {
              stepOrder: step.order,
              itemId: step.item_id,
              type: type,
              fileName: mediaItem.file_name,
              title: mediaItem.title
            });
            await onSendMedia({ name: mediaItem.file_name, url: mediaItem.file_url }, mediaItem.title, type);
            stepSent = true;
          } else {
            console.warn('⚠️ [handleSendFunnel] Mídia não encontrada:', {
              stepOrder: step.order,
              itemId: step.item_id,
              availableMedia: media?.map(m => m.id) || []
            });
          }
        }

        // Documento (PDF ou outros)
        else if ((normalizedType === 'document' || normalizedType === 'pdf' || normalizedType === 'doc') && onSendDocument) {
          const doc = documents?.find((d: any) => d.id === step.item_id);
          if (doc) {
            console.log('📄 [handleSendFunnel] Enviando documento:', {
              stepOrder: step.order,
              itemId: step.item_id,
              fileName: doc.file_name,
              title: doc.title
            });
            await onSendDocument({ name: doc.file_name, url: doc.file_url }, doc.title);
            stepSent = true;
          } else {
            console.warn('⚠️ [handleSendFunnel] Documento não encontrado:', {
              stepOrder: step.order,
              itemId: step.item_id,
              availableDocuments: documents?.map(d => d.id) || []
            });
          }
        } else {
          console.warn('⚠️ [handleSendFunnel] Tipo de step não reconhecido ou handler não disponível:', {
            stepOrder: step.order,
            type: step.type,
            typeLower: typeLower,
            normalizedType: normalizedType,
            hasOnSendMessage: !!onSendMessage,
            hasOnSendAudio: !!onSendAudio,
            hasOnSendMedia: !!onSendMedia,
            hasOnSendDocument: !!onSendDocument
          });
        }

        if (stepSent) {
          console.log('✅ [handleSendFunnel] Step enviado com sucesso:', {
            stepOrder: step.order,
            type: step.type
          });
        } else {
          console.error('❌ [handleSendFunnel] Step não foi enviado:', {
            stepOrder: step.order,
            type: step.type,
            itemId: step.item_id
          });
        }

        // Delay opcional entre etapas
        if (step.delay_seconds && step.delay_seconds > 0) {
          console.log('⏳ [handleSendFunnel] Aguardando delay:', {
            stepOrder: step.order,
            delaySeconds: step.delay_seconds
          });
          // eslint-disable-next-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, step.delay_seconds * 1000));
        }
      } catch (error) {
        console.error('❌ [handleSendFunnel] Erro ao enviar step:', {
          stepOrder: step.order,
          type: step.type,
          itemId: step.item_id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continuar com o próximo step mesmo se este falhar
      }
    }
    
    console.log('✅ [handleSendFunnel] Funil processado completamente');
    onOpenChange(false);
  };

  const renderFunnelItem = (funnel: Funnel) => (
    <div key={funnel.id} className="flex items-center justify-between p-3 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
          <Workflow className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <h4 className="font-medium text-sm truncate text-foreground overflow-hidden whitespace-nowrap">{funnel.title}</h4>
          <p className="text-xs text-muted-foreground truncate overflow-hidden whitespace-nowrap">{(funnel.steps || []).length} etapas</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleSendFunnel(funnel)}
        className="w-8 h-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderEmptyState = (type: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-3">
        {type === 'messages' && <MessageSquare className="w-6 h-6 text-muted-foreground" />}
        {type === 'audios' && <Music className="w-6 h-6 text-muted-foreground" />}
        {type === 'media' && <Image className="w-6 h-6 text-muted-foreground" />}
        {type === 'documents' && <FileText className="w-6 h-6 text-muted-foreground" />}
      </div>
      <p className="text-sm text-muted-foreground">
        Nenhum item encontrado
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Mensagens Rápidas</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="messages" className="p-2" title="Mensagens">
              <MessageSquare className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="audios" className="p-2" title="Áudios">
              <Music className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="media" className="p-2" title="Imagens/Vídeos">
              <Image className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="documents" className="p-2" title="Documentos">
              <FileText className="w-4 h-4" />
            </TabsTrigger>
          <TabsTrigger value="funnels" className="p-2" title="Funis">
            <Workflow className="w-4 h-4" />
          </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="messages" className="mt-0">
              <ScrollArea className="h-80">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  </div>
                ) : messages && messages.length > 0 ? (
                  <div className="space-y-0">
                    {messages.map(renderMessageItem)}
                  </div>
                ) : (
                  renderEmptyState('messages')
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="audios" className="mt-0">
              <ScrollArea className="h-80">
                {audiosLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  </div>
                ) : audios && audios.length > 0 ? (
                  <div className="space-y-0">
                    {audios.map(renderAudioItem)}
                  </div>
                ) : (
                  renderEmptyState('audios')
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="media" className="mt-0">
              <ScrollArea className="h-80">
                {mediaLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  </div>
                ) : media && media.length > 0 ? (
                  <div className="space-y-0">
                    {media.map(renderMediaItem)}
                  </div>
                ) : (
                  renderEmptyState('media')
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <ScrollArea className="h-80">
                {documentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-0">
                    {documents.map(renderDocumentItem)}
                  </div>
                ) : (
                  renderEmptyState('documents')
                )}
              </ScrollArea>
            </TabsContent>

          <TabsContent value="funnels" className="mt-0">
            <ScrollArea className="h-80">
              {funnelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                </div>
              ) : funnels && funnels.length > 0 ? (
                <div className="space-y-0">
                  {funnels.map(renderFunnelItem)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-3">
                    <Workflow className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhum funil encontrado</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}