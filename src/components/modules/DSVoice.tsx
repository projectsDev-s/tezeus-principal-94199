import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, Mic, Image, FileText, Filter, Play, Settings, Search, Edit, Trash2, Upload, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickMessages } from "@/hooks/useQuickMessages";
import { useQuickAudios } from "@/hooks/useQuickAudios";
import { useQuickMedia } from "@/hooks/useQuickMedia";
import { useQuickDocuments } from "@/hooks/useQuickDocuments";
import { useQuickFunnels, FunnelStep, Funnel } from "@/hooks/useQuickFunnels";

const categories = [
  { id: "mensagens", label: "Mensagens", icon: MessageSquare },
  { id: "audios", label: "Áudios", icon: Mic },
  { id: "midias", label: "Mídias", icon: Image },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "funis", label: "Funis", icon: Filter },
  // Ocultado temporariamente - { id: "gatilhos", label: "Gatilhos", icon: Play },
  // Ocultado temporariamente - { id: "configuracoes", label: "Configurações", icon: Settings },
];

export function DSVoice() {
  const [activeCategory, setActiveCategory] = useState("mensagens");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para modais de mensagens
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  // Estados para modais de áudios
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  
  // Estados para modais de mídias
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [editingMediaFileName, setEditingMediaFileName] = useState<string>("");
  
  // Estados para modais de documentos
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentCaption, setDocumentCaption] = useState("");
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocumentFileName, setEditingDocumentFileName] = useState<string>("");

  // Estados para funis
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [funnelName, setFunnelName] = useState("");
  const [funnelSteps, setFunnelSteps] = useState<any[]>([]);
  const [selectedStepType, setSelectedStepType] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [stepMinutes, setStepMinutes] = useState(0);
  const [stepSeconds, setStepSeconds] = useState(0);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);

  // Hooks para dados reais
  const { messages, loading: messagesLoading, createMessage, updateMessage, deleteMessage } = useQuickMessages();
  const { audios, loading: audiosLoading, createAudio, updateAudio, deleteAudio } = useQuickAudios();
  const { media, loading: mediaLoading, createMedia, updateMedia, deleteMedia } = useQuickMedia();
  const { documents, loading: documentsLoading, createDocument, updateDocument, deleteDocument } = useQuickDocuments();
  const { funnels, loading: funnelsLoading, createFunnel, updateFunnel, deleteFunnel } = useQuickFunnels();

  // Funções de conversão entre formato do componente e formato do banco
  const componentTypeToDbType = (type: string): 'message' | 'audio' | 'media' | 'document' => {
    switch (type) {
      case 'mensagens': return 'message';
      case 'audios': return 'audio';
      case 'midias': return 'media';
      case 'documentos': return 'document';
      default: return 'message';
    }
  };

  const dbTypeToComponentType = (type: string): string => {
    switch (type) {
      case 'message': return 'mensagens';
      case 'audio': return 'audios';
      case 'media': return 'midias';
      case 'document': return 'documentos';
      default: return type;
    }
  };

  const convertStepToDbFormat = (step: any, index: number): FunnelStep => {
    return {
      id: step.id || Date.now().toString() + index,
      type: componentTypeToDbType(step.type),
      item_id: step.itemId,
      delay_seconds: (step.delayMinutes || 0) * 60 + (step.delaySeconds || 0),
      order: index,
    };
  };

  const convertStepFromDbFormat = (step: FunnelStep): any => {
    return {
      id: step.id,
      type: dbTypeToComponentType(step.type),
      itemId: step.item_id,
      delayMinutes: Math.floor(step.delay_seconds / 60),
      delaySeconds: step.delay_seconds % 60,
    };
  };

  // Handlers para mensagens
  const handleCreateMessage = async () => {
    if (messageTitle.trim() && messageContent.trim()) {
      if (editingMessageId) {
        await updateMessage(editingMessageId, messageTitle, messageContent);
      } else {
        await createMessage(messageTitle, messageContent);
      }
      handleCloseMessageModal();
    }
  };

  const handleEditMessage = (message: any) => {
    setMessageTitle(message.title);
    setMessageContent(message.content);
    setEditingMessageId(message.id);
    setIsMessageModalOpen(true);
  };

  const handleDeleteMessage = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
      await deleteMessage(id);
    }
  };

  const handleCloseMessageModal = () => {
    setIsMessageModalOpen(false);
    setMessageTitle("");
    setMessageContent("");
    setEditingMessageId(null);
  };

  // Handlers para áudios
  const handleCreateAudio = async () => {
    if (audioTitle.trim() && audioFile) {
      if (editingAudioId) {
        await updateAudio(editingAudioId, audioTitle, audioFile);
      } else {
        await createAudio(audioTitle, audioFile);
      }
      handleCloseAudioModal();
    }
  };

  const handleEditAudio = (audio: any) => {
    setAudioTitle(audio.title);
    setEditingAudioId(audio.id);
    setIsAudioModalOpen(true);
  };

  const handleDeleteAudio = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este áudio?')) {
      await deleteAudio(id);
    }
  };

  const handleCloseAudioModal = () => {
    setIsAudioModalOpen(false);
    setAudioTitle("");
    setAudioFile(null);
    setEditingAudioId(null);
  };

  // Handlers para mídias
  const handleCreateMedia = async () => {
    if (!mediaTitle.trim()) return;
    
    if (editingMediaId) {
      // Ao editar, arquivo é opcional
      await updateMedia(editingMediaId, mediaTitle, mediaFile || undefined, mediaCaption);
    } else {
      // Ao criar, arquivo é obrigatório
      if (!mediaFile) return;
      await createMedia(mediaTitle, mediaFile, mediaCaption);
    }
    handleCloseMediaModal();
  };

  const handleEditMedia = (mediaItem: any) => {
    setEditingMediaId(mediaItem.id);
    setMediaTitle(mediaItem.title);
    setMediaCaption(mediaItem.caption || "");
    setEditingMediaFileName(mediaItem.file_name || "");
    setIsMediaModalOpen(true);
  };

  const handleDeleteMedia = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta mídia?')) {
      await deleteMedia(id);
    }
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setMediaTitle("");
    setMediaFile(null);
    setMediaCaption("");
    setEditingMediaId(null);
    setEditingMediaFileName("");
  };

  // Handlers para documentos
  const handleCreateDocument = async () => {
    if (!documentTitle.trim()) return;
    
    if (editingDocumentId) {
      // Ao editar, arquivo é opcional
      await updateDocument(editingDocumentId, documentTitle, documentFile || undefined, documentCaption);
    } else {
      // Ao criar, arquivo é obrigatório
      if (!documentFile) return;
      await createDocument(documentTitle, documentFile, documentCaption);
    }
    handleCloseDocumentModal();
  };

  const handleEditDocument = (document: any) => {
    setDocumentTitle(document.title);
    setDocumentCaption(document.caption || "");
    setEditingDocumentId(document.id);
    setEditingDocumentFileName(document.file_name || "");
    setIsDocumentModalOpen(true);
  };

  const handleDeleteDocument = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este documento?')) {
      await deleteDocument(id);
    }
  };

  const handleCloseDocumentModal = () => {
    setIsDocumentModalOpen(false);
    setDocumentTitle("");
    setDocumentFile(null);
    setDocumentCaption("");
    setEditingDocumentId(null);
    setEditingDocumentFileName("");
  };

  // Handlers para funis
  const handleOpenFunnelModal = () => {
    setFunnelName("");
    setFunnelSteps([]);
    setEditingFunnelId(null);
    setIsFunnelModalOpen(true);
  };

  const handleCloseFunnelModal = () => {
    setIsFunnelModalOpen(false);
    setFunnelName("");
    setFunnelSteps([]);
    setEditingFunnelId(null);
  };

  const handleEditFunnel = (funnel: Funnel) => {
    setFunnelName(funnel.title);
    setFunnelSteps(funnel.steps.map(convertStepFromDbFormat));
    setEditingFunnelId(funnel.id);
    setIsFunnelModalOpen(true);
  };

  const handleDeleteFunnel = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este funil?')) {
      await deleteFunnel(id);
    }
  };

  const handleOpenAddStepModal = () => {
    setSelectedStepType(null);
    setSelectedItemId("");
    setStepMinutes(0);
    setStepSeconds(0);
    setIsAddStepModalOpen(true);
  };

  const handleCloseAddStepModal = () => {
    setIsAddStepModalOpen(false);
    setSelectedStepType(null);
    setSelectedItemId("");
    setStepMinutes(0);
    setStepSeconds(0);
  };

  const handleAddStep = () => {
    if (selectedStepType && selectedItemId) {
      const newStep = {
        id: Date.now().toString(),
        type: selectedStepType,
        itemId: selectedItemId,
        delayMinutes: stepMinutes,
        delaySeconds: stepSeconds,
      };
      setFunnelSteps([...funnelSteps, newStep]);
      handleCloseAddStepModal();
    }
  };

  const handleSaveFunnel = async () => {
    if (funnelName.trim() && funnelSteps.length > 0) {
      // Converter steps para formato do banco
      const dbSteps: FunnelStep[] = funnelSteps.map((step, index) => 
        convertStepToDbFormat(step, index)
      );

      if (editingFunnelId) {
        // Atualizar funil existente
        await updateFunnel(editingFunnelId, funnelName, dbSteps);
      } else {
        // Criar novo funil
        await createFunnel(funnelName, dbSteps);
      }
      handleCloseFunnelModal();
    }
  };

  const getItemDetails = (type: string, itemId: string) => {
    // Converter tipo do banco para tipo do componente se necessário
    const componentType = dbTypeToComponentType(type);
    
    switch (componentType) {
      case "mensagens":
        return messages.find(m => m.id === itemId);
      case "audios":
        return audios.find(a => a.id === itemId);
      case "midias":
        return media.find(m => m.id === itemId);
      case "documentos":
        return documents.find(d => d.id === itemId);
      default:
        return null;
    }
  };

  // Filtrar dados baseado no termo de busca
  const filteredMessages = messages.filter(msg => 
    msg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAudios = audios.filter(audio => 
    audio.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMedia = media.filter(mediaItem => 
    mediaItem.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFunnels = funnels.filter(funnel => 
    funnel.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderContent = () => {
    const loading = messagesLoading || audiosLoading || mediaLoading || documentsLoading || funnelsLoading;

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      );
    }

    switch (activeCategory) {
      case "mensagens":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMessages.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Nenhuma mensagem rápida encontrada.
              </div>
            ) : (
              filteredMessages.map((message) => (
                <Card key={message.id} className="bg-purple-100 border-purple-200 hover:bg-purple-50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-purple-900 text-sm leading-tight">{message.title}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                          onClick={() => handleEditMessage(message)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-purple-700 leading-relaxed">{message.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case "audios":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAudios.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Nenhum áudio rápido encontrado.
              </div>
            ) : (
              filteredAudios.map((audio) => (
                <Card key={audio.id} className="bg-purple-100 border-purple-200 hover:bg-purple-50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-purple-900 text-sm leading-tight">{audio.title}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                          onClick={() => handleEditAudio(audio)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                          onClick={() => handleDeleteAudio(audio.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-purple-700">{audio.file_name}</p>
                    {audio.duration_seconds && (
                      <p className="text-xs text-purple-600 mt-1">
                        Duração: {Math.floor(audio.duration_seconds / 60)}:{(audio.duration_seconds % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case "midias":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMedia.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Nenhuma mídia rápida encontrada.
              </div>
            ) : (
              filteredMedia.map((mediaItem) => (
                <Card key={mediaItem.id} className="bg-purple-100 border-purple-200 hover:bg-purple-50 transition-colors overflow-hidden">
                  {mediaItem.file_type.startsWith('image/') && mediaItem.file_url && (
                    <div className="w-full h-32 bg-muted relative overflow-hidden">
                      <img 
                        src={mediaItem.file_url} 
                        alt={mediaItem.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {mediaItem.file_type.startsWith('video/') && mediaItem.file_url && (
                    <div className="w-full h-32 bg-muted relative overflow-hidden">
                      <video 
                        src={mediaItem.file_url}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-purple-900 text-sm leading-tight">{mediaItem.title}</h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                          onClick={() => handleEditMedia(mediaItem)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                          onClick={() => handleDeleteMedia(mediaItem.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-purple-700">{mediaItem.file_name}</p>
                    <p className="text-xs text-purple-600 mt-1">Tipo: {mediaItem.file_type}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case "documentos":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Nenhum documento rápido encontrado.
              </div>
            ) : (
              filteredDocuments.map((document) => {
                const getDocIcon = () => {
                  if (document.file_type.includes('pdf')) return <FileText className="w-12 h-12 text-red-600" />;
                  if (document.file_type.includes('excel') || document.file_type.includes('spreadsheet')) return <FileText className="w-12 h-12 text-green-600" />;
                  if (document.file_type.includes('word') || document.file_type.includes('document')) return <FileText className="w-12 h-12 text-blue-600" />;
                  if (document.file_type.includes('powerpoint') || document.file_type.includes('presentation')) return <FileText className="w-12 h-12 text-orange-600" />;
                  return <FileText className="w-12 h-12 text-gray-600" />;
                };

                return (
                  <Card key={document.id} className="bg-purple-100 border-purple-200 hover:bg-purple-50 transition-colors overflow-hidden">
                    <div className="w-full h-32 bg-muted flex items-center justify-center">
                      {getDocIcon()}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-purple-900 text-sm leading-tight">{document.title}</h3>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                            onClick={() => handleEditDocument(document)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                            onClick={() => handleDeleteDocument(document.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-purple-700">{document.file_name}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        {document.file_size && `${(document.file_size / 1024 / 1024).toFixed(2)} MB`}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        );

      case "funis":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFunnels.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {searchTerm ? 'Nenhum funil encontrado.' : 'Nenhum funil criado ainda.'}
              </div>
            ) : (
              filteredFunnels.map((funnel) => {
                // Ordenar steps por order
                const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);
                
                return (
                  <Card key={funnel.id} className="bg-purple-100 border-purple-200 hover:bg-purple-50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-purple-900 text-sm leading-tight">{funnel.title}</h3>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                            onClick={() => handleEditFunnel(funnel)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800"
                            onClick={() => handleDeleteFunnel(funnel.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {sortedSteps.map((step: FunnelStep, index: number) => {
                        const itemDetails = getItemDetails(step.type, step.item_id);
                        const delayMinutes = Math.floor(step.delay_seconds / 60);
                        const delaySeconds = step.delay_seconds % 60;
                        return (
                          <div key={step.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded text-xs">
                            <div className="flex-shrink-0 bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-purple-900 font-medium truncate">{itemDetails?.title || 'Item não encontrado'}</p>
                              <p className="text-purple-600">
                                {dbTypeToComponentType(step.type)} • {delayMinutes}m {delaySeconds}s
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        );

      case "gatilhos":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Gatilhos</h3>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Funcionalidade em desenvolvimento.
            </div>
          </div>
        );

      case "configuracoes":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Configurações</h3>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Funcionalidade em desenvolvimento.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Categories Tabs */}
      <div className="border-b">
        <div className="p-4 pb-0">
          <div className="flex space-x-1">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? "default" : "ghost"}
                  className={cn(
                    "flex items-center gap-2 rounded-b-none",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header com busca e botão */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar item"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            variant="default"
            onClick={() => {
              if (activeCategory === "mensagens") setIsMessageModalOpen(true);
              else if (activeCategory === "audios") setIsAudioModalOpen(true);
              else if (activeCategory === "midias") setIsMediaModalOpen(true);
              else if (activeCategory === "documentos") setIsDocumentModalOpen(true);
              else if (activeCategory === "funis") setIsFunnelModalOpen(true);
            }}
          >
            Novo Item
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {renderContent()}
      </div>

      {/* Modal para Mensagens */}
      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMessageId ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
            <DialogDescription>
              {editingMessageId ? 'Edite os dados da mensagem rápida.' : 'Crie uma nova mensagem rápida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                placeholder="Digite o título da mensagem"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Digite o conteúdo da mensagem"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMessageModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMessage}>
                {editingMessageId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Áudios */}
      <Dialog open={isAudioModalOpen} onOpenChange={setIsAudioModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAudioId ? 'Editar Áudio' : 'Novo Áudio'}</DialogTitle>
            <DialogDescription>
              {editingAudioId ? 'Edite os dados do áudio rápido.' : 'Adicione um novo áudio rápido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Digite o título do áudio"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo de Áudio</label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseAudioModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateAudio} disabled={!audioTitle.trim() || (!audioFile && !editingAudioId)}>
                {editingAudioId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Mídias */}
      <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMediaId ? 'Editar Mídia' : 'Nova Mídia'}</DialogTitle>
            <DialogDescription>
              {editingMediaId ? 'Edite os dados da mídia rápida.' : 'Adicione uma nova mídia rápida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                placeholder="Digite o título da mídia"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo de Mídia</label>
              {editingMediaId && editingMediaFileName && (
                <p className="text-xs text-muted-foreground mb-2">
                  Arquivo atual: <span className="font-medium">{editingMediaFileName}</span>
                </p>
              )}
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
              {editingMediaId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para manter o arquivo atual
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Legenda (Caption)</label>
              <Textarea
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Digite a legenda para a mídia (opcional)"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMediaModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMedia} disabled={!mediaTitle.trim() || (!mediaFile && !editingMediaId)}>
                {editingMediaId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Documentos */}
      <Dialog open={isDocumentModalOpen} onOpenChange={setIsDocumentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDocumentId ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
            <DialogDescription>
              {editingDocumentId ? 'Edite os dados do documento rápido.' : 'Adicione um novo documento rápido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Digite o título do documento"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo do Documento</label>
              {editingDocumentId && editingDocumentFileName && (
                <p className="text-xs text-muted-foreground mb-2">
                  Arquivo atual: <span className="font-medium">{editingDocumentFileName}</span>
                </p>
              )}
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              />
              {editingDocumentId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para manter o arquivo atual
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Legenda (Caption)</label>
              <Textarea
                value={documentCaption}
                onChange={(e) => setDocumentCaption(e.target.value)}
                placeholder="Digite a legenda para o documento (opcional)"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseDocumentModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDocument} disabled={!documentTitle.trim() || (!documentFile && !editingDocumentId)}>
                {editingDocumentId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Criar Funil */}
      <Dialog open={isFunnelModalOpen} onOpenChange={setIsFunnelModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingFunnelId ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
            <DialogDescription>
              Crie um funil com múltiplas etapas e delays configuráveis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Funil</label>
              <Input
                value={funnelName}
                onChange={(e) => setFunnelName(e.target.value)}
                placeholder="Digite o nome do funil"
              />
            </div>

            {/* Etapas do Funil */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium">Etapas</label>
                <Button onClick={handleOpenAddStepModal} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Etapas
                </Button>
              </div>

              {funnelSteps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  Nenhuma etapa adicionada ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {funnelSteps.map((step, index) => {
                    const itemDetails = getItemDetails(step.type, step.itemId);
                    const Icon = step.type === "mensagens" ? MessageSquare 
                              : step.type === "audios" ? Mic 
                              : step.type === "midias" ? Image 
                              : FileText;
                    return (
                      <Card key={step.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{itemDetails?.title || 'Item não encontrado'}</p>
                            <p className="text-xs text-muted-foreground">
                              {step.type} • Delay: {step.delayMinutes}min {step.delaySeconds}s
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFunnelSteps(funnelSteps.filter(s => s.id !== step.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={handleCloseFunnelModal}>
                Cancelar
              </Button>
              <Button onClick={handleSaveFunnel} disabled={!funnelName.trim() || funnelSteps.length === 0}>
                {editingFunnelId ? 'Salvar Alterações' : 'Salvar Funil'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Adicionar Etapa */}
      <Dialog open={isAddStepModalOpen} onOpenChange={setIsAddStepModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Item</DialogTitle>
            <DialogDescription>
              Selecione o tipo de conteúdo e configure o delay da etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Seleção de Tipo */}
            <div>
              <label className="text-sm font-medium mb-3 block">Tipo de Mensagem</label>
              <div className="grid grid-cols-4 gap-3">
                <button
                  onClick={() => setSelectedStepType("mensagens")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    selectedStepType === "mensagens"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <MessageSquare className="h-6 w-6" />
                  <span className="text-xs font-medium">Mensagens</span>
                </button>
                <button
                  onClick={() => setSelectedStepType("audios")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    selectedStepType === "audios"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Mic className="h-6 w-6" />
                  <span className="text-xs font-medium">Áudios</span>
                </button>
                <button
                  onClick={() => setSelectedStepType("midias")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    selectedStepType === "midias"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Image className="h-6 w-6" />
                  <span className="text-xs font-medium">Imagens</span>
                </button>
                <button
                  onClick={() => setSelectedStepType("documentos")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    selectedStepType === "documentos"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <FileText className="h-6 w-6" />
                  <span className="text-xs font-medium">Documentos</span>
                </button>
              </div>
            </div>

            {/* Select do Item */}
            {selectedStepType && (
              <div>
                <label className="text-sm font-medium">Selecionar Item</label>
                <select
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                >
                  <option value="">Selecione um item</option>
                  {selectedStepType === "mensagens" && messages.map(msg => (
                    <option key={msg.id} value={msg.id}>{msg.title}</option>
                  ))}
                  {selectedStepType === "audios" && audios.map(audio => (
                    <option key={audio.id} value={audio.id}>{audio.title}</option>
                  ))}
                  {selectedStepType === "midias" && media.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                  {selectedStepType === "documentos" && documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Configuração de Delay */}
            <div>
              <label className="text-sm font-medium mb-2 block">Delay para executar a ação</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Minutos</label>
                  <Input
                    type="number"
                    min="0"
                    value={stepMinutes}
                    onChange={(e) => setStepMinutes(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Segundos</label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={stepSeconds}
                    onChange={(e) => setStepSeconds(Math.min(59, parseInt(e.target.value) || 0))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={handleCloseAddStepModal}>
                Cancelar
              </Button>
              <Button onClick={handleAddStep} disabled={!selectedStepType || !selectedItemId}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}