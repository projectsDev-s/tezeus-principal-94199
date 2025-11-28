import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// Removido Table shadcn em favor de table nativa HTML estilo Excel
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, Mic, Image, FileText, Filter, Play, Settings, Search, Edit, Trash2, Upload, Plus, GripVertical, Download } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { useQuickMessages } from "@/hooks/useQuickMessages";
import { useQuickAudios } from "@/hooks/useQuickAudios";
import { useQuickMedia } from "@/hooks/useQuickMedia";
import { useQuickDocuments } from "@/hooks/useQuickDocuments";
import { useQuickFunnels, FunnelStep, Funnel } from "@/hooks/useQuickFunnels";

const categories = [{
  id: "mensagens",
  label: "Mensagens",
  icon: MessageSquare
}, {
  id: "audios",
  label: "Áudios",
  icon: Mic
}, {
  id: "midias",
  label: "Mídias",
  icon: Image
}, {
  id: "documentos",
  label: "Documentos",
  icon: FileText
}, {
  id: "funis",
  label: "Funis",
  icon: Filter
}
// Ocultado temporariamente - { id: "gatilhos", label: "Gatilhos", icon: Play },
// Ocultado temporariamente - { id: "configuracoes", label: "Configurações", icon: Settings },
];

interface SortableFunnelStepProps {
  step: any;
  index: number;
  itemDetails: any;
  onDelete: (id: string) => void;
}

function SortableFunnelStep({ step, index, itemDetails, onDelete }: SortableFunnelStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = step.type === "mensagens" ? MessageSquare : step.type === "audios" ? Mic : step.type === "midias" ? Image : FileText;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-3 mb-2">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab hover:text-primary text-muted-foreground touch-none">
             <GripVertical className="h-4 w-4" />
          </div>
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
          <Button variant="ghost" size="sm" onClick={() => onDelete(step.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

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
  
  // Selection states for checkboxes (Excel style)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFunnelSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Hooks para dados reais
  const {
    messages,
    loading: messagesLoading,
    createMessage,
    updateMessage,
    deleteMessage
  } = useQuickMessages();
  const {
    audios,
    loading: audiosLoading,
    createAudio,
    updateAudio,
    deleteAudio
  } = useQuickAudios();
  const {
    media,
    loading: mediaLoading,
    createMedia,
    updateMedia,
    deleteMedia
  } = useQuickMedia();
  const {
    documents,
    loading: documentsLoading,
    createDocument,
    updateDocument,
    deleteDocument
  } = useQuickDocuments();
  const {
    funnels,
    loading: funnelsLoading,
    createFunnel,
    updateFunnel,
    deleteFunnel
  } = useQuickFunnels();

  // Funções de conversão entre formato do componente e formato do banco
  const componentTypeToDbType = (type: string): 'message' | 'audio' | 'media' | 'document' => {
    switch (type) {
      case 'mensagens':
        return 'message';
      case 'audios':
        return 'audio';
      case 'midias':
        return 'media';
      case 'documentos':
        return 'document';
      default:
        return 'message';
    }
  };
  const dbTypeToComponentType = (type: string): string => {
    switch (type) {
      case 'message':
        return 'mensagens';
      case 'audio':
        return 'audios';
      case 'media':
        return 'midias';
      case 'document':
        return 'documentos';
      default:
        return type;
    }
  };
  const convertStepToDbFormat = (step: any, index: number): FunnelStep => {
    return {
      id: step.id || Date.now().toString() + index,
      type: componentTypeToDbType(step.type),
      item_id: step.itemId,
      delay_seconds: (step.delayMinutes || 0) * 60 + (step.delaySeconds || 0),
      order: index
    };
  };
  const convertStepFromDbFormat = (step: FunnelStep): any => {
    return {
      id: step.id,
      type: dbTypeToComponentType(step.type),
      itemId: step.item_id,
      delayMinutes: Math.floor(step.delay_seconds / 60),
      delaySeconds: step.delay_seconds % 60
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
        delaySeconds: stepSeconds
      };
      setFunnelSteps([...funnelSteps, newStep]);
      handleCloseAddStepModal();
    }
  };
  const handleSaveFunnel = async () => {
    if (funnelName.trim() && funnelSteps.length > 0) {
      // Converter steps para formato do banco
      const dbSteps: FunnelStep[] = funnelSteps.map((step, index) => convertStepToDbFormat(step, index));
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
  const filteredMessages = messages.filter(msg => msg.title.toLowerCase().includes(searchTerm.toLowerCase()) || msg.content.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAudios = audios.filter(audio => audio.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredMedia = media.filter(mediaItem => mediaItem.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDocuments = documents.filter(doc => doc.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFunnels = funnels.filter(funnel => funnel.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Renderizador de tabelas Excel
  const renderTable = (headers: string[], data: any[], renderRow: (item: any) => React.ReactNode) => {
    return (
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full border-collapse bg-white text-xs font-sans">
          <thead className="bg-[#f3f3f3] sticky top-0 z-10">
            <tr>
              {headers.map((header, i) => (
                <th key={i} className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[120px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>{header}</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              ))}
              <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[80px]">
                <div className="flex items-center justify-between">
                   <span>Ações</span>
                   <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground">
                  Nenhum item encontrado.
                </td>
              </tr>
            ) : (
              data.map((item) => renderRow(item))
            )}
             {/* Empty rows filler */}
             {data.length > 0 && Array.from({ length: Math.max(0, 15 - data.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-[32px]">
                   {headers.map((_, j) => <td key={j} className="border border-[#e0e0e0]"></td>)}
                   <td className="border border-[#e0e0e0] bg-gray-50"></td>
                </tr>
             ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    const loading = messagesLoading || audiosLoading || mediaLoading || documentsLoading || funnelsLoading;
    if (loading) {
      return <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>;
    }

    switch (activeCategory) {
      case "mensagens":
        return renderTable(
          ["Título", "Conteúdo"],
          filteredMessages,
          (message) => (
            <tr key={message.id} className="hover:bg-blue-50 group h-[32px]">
              <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap font-medium">{message.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 max-w-xl truncate" title={message.content}>{message.content}</td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600" onClick={() => handleEditMessage(message)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600" onClick={() => handleDeleteMessage(message.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "audios":
        return renderTable(
          ["Título", "Arquivo", "Duração"],
          filteredAudios,
          (audio) => (
            <tr key={audio.id} className="hover:bg-blue-50 group h-[32px]">
              <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap font-medium">{audio.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0">{audio.file_name}</td>
              <td className="border border-[#e0e0e0] px-2 py-0">
                {audio.duration_seconds
                  ? `${Math.floor(audio.duration_seconds / 60)}:${(audio.duration_seconds % 60)
                      .toString()
                      .padStart(2, '0')}`
                  : '-'}
              </td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600" onClick={() => handleEditAudio(audio)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600" onClick={() => handleDeleteAudio(audio.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "midias":
        return renderTable(
          ["Preview", "Título", "Arquivo", "Tipo"],
          filteredMedia,
          (mediaItem) => (
            <tr key={mediaItem.id} className="hover:bg-blue-50 group h-[40px]">
              <td className="border border-[#e0e0e0] px-2 py-0 w-[50px]">
                <div className="w-8 h-8 bg-muted rounded overflow-hidden flex items-center justify-center mx-auto my-0.5">
                  {mediaItem.file_type.startsWith('image/') && mediaItem.file_url ? (
                    <img
                      src={mediaItem.file_url}
                      alt={mediaItem.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : mediaItem.file_type.startsWith('video/') ? (
                    <Play className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Image className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </td>
              <td className="border border-[#e0e0e0] px-2 py-0 font-medium">{mediaItem.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 truncate max-w-[200px]">{mediaItem.file_name}</td>
              <td className="border border-[#e0e0e0] px-2 py-0">{mediaItem.file_type}</td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                 <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600" onClick={() => handleEditMedia(mediaItem)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600" onClick={() => handleDeleteMedia(mediaItem.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "documentos":
        return renderTable(
          ["Tipo", "Título", "Arquivo", "Tamanho"],
          filteredDocuments,
          (document) => {
             const getDocIcon = () => {
              if (document.file_type.includes('pdf')) return <FileText className="w-4 h-4 text-red-600" />;
              if (document.file_type.includes('excel') || document.file_type.includes('spreadsheet'))
                return <FileText className="w-4 h-4 text-green-600" />;
              if (document.file_type.includes('word') || document.file_type.includes('document'))
                return <FileText className="w-4 h-4 text-blue-600" />;
              if (document.file_type.includes('powerpoint') || document.file_type.includes('presentation'))
                return <FileText className="w-4 h-4 text-orange-600" />;
              return <FileText className="w-4 h-4 text-gray-600" />;
            };
            return (
              <tr key={document.id} className="hover:bg-blue-50 group h-[32px]">
                <td className="border border-[#e0e0e0] px-2 py-0 text-center w-[50px]">{getDocIcon()}</td>
                <td className="border border-[#e0e0e0] px-2 py-0 font-medium">{document.title}</td>
                <td className="border border-[#e0e0e0] px-2 py-0 truncate max-w-[200px]">{document.file_name}</td>
                <td className="border border-[#e0e0e0] px-2 py-0">
                   {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
                </td>
                <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                  <div className="flex items-center justify-center gap-1 h-full">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600" onClick={() => handleEditDocument(document)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600" onClick={() => handleDeleteDocument(document.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          }
        );
      case "funis":
        return renderTable(
          ["Nome do Funil", "Qtd. Etapas"],
          filteredFunnels,
          (funnel) => (
            <tr key={funnel.id} className="hover:bg-blue-50 group h-[32px]">
              <td className="border border-[#e0e0e0] px-2 py-0 font-medium">{funnel.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0">
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {funnel.steps.length} etapas
                </span>
              </td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600" onClick={() => handleEditFunnel(funnel)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600" onClick={() => handleDeleteFunnel(funnel.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "gatilhos":
        return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
             <Play className="h-10 w-10 mb-2 opacity-20" />
             <p>Funcionalidade em desenvolvimento.</p>
          </div>;
      case "configuracoes":
        return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Settings className="h-10 w-10 mb-2 opacity-20" />
            <p>Funcionalidade em desenvolvimento.</p>
          </div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs">
      {/* Excel-like Toolbar (Ribbonish) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa]">
        {/* Title Bar / Top Menu */}
        <div className="flex items-center justify-between px-4 py-1 bg-primary text-primary-foreground h-8">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-semibold text-sm">Respostas Rápidas</span>
          </div>
          <div className="text-[10px] opacity-80">
             {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
           {/* Search Group */}
           <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3" />
              <Input
                placeholder="Pesquisar item..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={() => {
                if (activeCategory === "mensagens") setIsMessageModalOpen(true);
                else if (activeCategory === "audios") setIsAudioModalOpen(true);
                else if (activeCategory === "midias") setIsMediaModalOpen(true);
                else if (activeCategory === "documentos") setIsDocumentModalOpen(true);
                else if (activeCategory === "funis") setIsFunnelModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Novo Item</span>
            </Button>

             <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Exportar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area (Table) */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6]">
        {renderContent()}
      </div>

      {/* Footer Sheets (Categories) */}
      <div className="flex items-center border-t border-gray-300 bg-[#f0f0f0] px-1 h-8 select-none">
         <div className="flex items-end h-full gap-1 overflow-x-auto px-1">
            {categories.map(category => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <div
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 h-[26px] text-xs cursor-pointer border-t border-l border-r rounded-t-sm transition-all",
                    isActive 
                      ? "bg-white border-gray-300 border-b-white text-primary font-medium z-10 shadow-sm translate-y-[1px]" 
                      : "bg-[#e0e0e0] border-transparent text-gray-600 hover:bg-[#e8e8e8]"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{category.label}</span>
                </div>
              );
            })}
         </div>
      </div>

      {/* Modals - Mantidos iguais */}
      
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
              <Input value={messageTitle} onChange={e => setMessageTitle(e.target.value)} placeholder="Digite o título da mensagem" />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea value={messageContent} onChange={e => setMessageContent(e.target.value)} placeholder="Digite o conteúdo da mensagem" rows={4} />
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
              <Input value={audioTitle} onChange={e => setAudioTitle(e.target.value)} placeholder="Digite o título do áudio" />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo de Áudio</label>
              <Input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseAudioModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateAudio} disabled={!audioTitle.trim() || !audioFile && !editingAudioId}>
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
              <Input value={mediaTitle} onChange={e => setMediaTitle(e.target.value)} placeholder="Digite o título da mídia" />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo de Mídia</label>
              {editingMediaId && editingMediaFileName && <p className="text-xs text-muted-foreground mb-2">
                  Arquivo atual: <span className="font-medium">{editingMediaFileName}</span>
                </p>}
              <Input type="file" accept="image/*,video/*" onChange={e => setMediaFile(e.target.files?.[0] || null)} />
              {editingMediaId && <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para manter o arquivo atual
                </p>}
            </div>
            <div>
              <label className="text-sm font-medium">Legenda (Caption)</label>
              <Textarea value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Digite a legenda para a mídia (opcional)" rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMediaModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMedia} disabled={!mediaTitle.trim() || !mediaFile && !editingMediaId}>
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
              <Input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} placeholder="Digite o título do documento" />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo do Documento</label>
              {editingDocumentId && editingDocumentFileName && <p className="text-xs text-muted-foreground mb-2">
                  Arquivo atual: <span className="font-medium">{editingDocumentFileName}</span>
                </p>}
              <Input type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" onChange={e => setDocumentFile(e.target.files?.[0] || null)} />
              {editingDocumentId && <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para manter o arquivo atual
                </p>}
            </div>
            <div>
              <label className="text-sm font-medium">Legenda (Caption)</label>
              <Textarea value={documentCaption} onChange={e => setDocumentCaption(e.target.value)} placeholder="Digite a legenda para o documento (opcional)" rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseDocumentModal}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDocument} disabled={!documentTitle.trim() || !documentFile && !editingDocumentId}>
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
              <Input value={funnelName} onChange={e => setFunnelName(e.target.value)} placeholder="Digite o nome do funil" />
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

              {funnelSteps.length === 0 ? <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  Nenhuma etapa adicionada ainda.
                </div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={funnelSteps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {funnelSteps.map((step, index) => {
                        const itemDetails = getItemDetails(step.type, step.itemId);
                        return (
                          <SortableFunnelStep
                            key={step.id}
                            step={step}
                            index={index}
                            itemDetails={itemDetails}
                            onDelete={(id) => setFunnelSteps(prev => prev.filter(s => s.id !== id))}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>}
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
                <button onClick={() => setSelectedStepType("mensagens")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "mensagens" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                  <MessageSquare className="h-6 w-6" />
                  <span className="text-xs font-medium">Mensagens</span>
                </button>
                <button onClick={() => setSelectedStepType("audios")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "audios" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                  <Mic className="h-6 w-6" />
                  <span className="text-xs font-medium">Áudios</span>
                </button>
                <button onClick={() => setSelectedStepType("midias")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "midias" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                  <Image className="h-6 w-6" />
                  <span className="text-xs font-medium">Mídias</span>
                </button>
                <button onClick={() => setSelectedStepType("documentos")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "documentos" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                  <FileText className="h-6 w-6" />
                  <span className="text-xs font-medium">Documentos</span>
                </button>
              </div>
            </div>

            {/* Select do Item */}
            {selectedStepType && <div>
                <label className="text-sm font-medium">Selecionar Item</label>
                <select className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                  <option value="">Selecione um item</option>
                  {selectedStepType === "mensagens" && messages.map(msg => <option key={msg.id} value={msg.id}>{msg.title}</option>)}
                  {selectedStepType === "audios" && audios.map(audio => <option key={audio.id} value={audio.id}>{audio.title}</option>)}
                  {selectedStepType === "midias" && media.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  {selectedStepType === "documentos" && documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                </select>
              </div>}

            {/* Configuração de Delay */}
            <div>
              <label className="text-sm font-medium mb-2 block">Delay para executar a ação</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Minutos</label>
                  <Input type="number" min="0" value={stepMinutes} onChange={e => setStepMinutes(parseInt(e.target.value) || 0)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Segundos</label>
                  <Input type="number" min="0" max="59" value={stepSeconds} onChange={e => setStepSeconds(Math.min(59, parseInt(e.target.value) || 0))} placeholder="0" />
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
