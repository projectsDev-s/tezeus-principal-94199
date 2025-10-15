import { useState, useEffect, useRef } from "react";
import { User, Briefcase, FileText, Paperclip, Pencil, Trash2, Plus, Pin, MapPin, MessageCircle, Trophy, Mail, Phone, Home, Globe, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { usePipelineCards } from "@/hooks/usePipelineCards";
import { useContactPipelineCards } from '@/hooks/useContactPipelineCards';
import { useContactObservations, ContactObservation } from '@/hooks/useContactObservations';
import { useContactExtraInfo } from '@/hooks/useContactExtraInfo';
import { CriarNegocioModal } from './modals/CriarNegocioModal';
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ImageModal } from './chat/ImageModal';
import { PdfModal } from './chat/PdfModal';
import { VideoModal } from './chat/VideoModal';
import { supabase } from "@/integrations/supabase/client";
interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  profile_image_url?: string;
  extra_info?: Record<string, any>;
}
interface Deal {
  id: string;
  title: string;
  description?: string;
  value: number;
  status: string;
  pipeline: string;
  column_name: string;
}
interface ContactSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onContactUpdated?: () => void;
}
const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};
const getAvatarColor = (name: string) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
export function ContactSidePanel({
  isOpen,
  onClose,
  contact,
  onContactUpdated
}: ContactSidePanelProps) {
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [customFields, setCustomFields] = useState<Array<{
    key: string;
    value: string;
  }>>([]);
  const [newCustomField, setNewCustomField] = useState({
    key: '',
    value: ''
  });
  const [newObservation, setNewObservation] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const editingFileInputRef = useRef<HTMLInputElement>(null);
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null);
  const [isCreateDealModalOpen, setIsCreateDealModalOpen] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingFieldType, setEditingFieldType] = useState<'key' | 'value' | null>(null);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [editingDealTitle, setEditingDealTitle] = useState<string>('');
  const [stats, setStats] = useState({
    activeConversations: 0,
    activeDeals: 0,
    closedDeals: 0
  });
  const {
    pipelines
  } = usePipelines();
  const {
    columns,
    fetchColumns
  } = usePipelineColumns(null);
  const {
    cards: contactCards,
    currentPipeline,
    transferToPipeline,
    isLoading: cardsLoading
  } = useContactPipelineCards(contact?.id || null);
  const {
    createCard
  } = usePipelineCards(null);
  const {
    toast
  } = useToast();
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    observations: realObservations,
    addObservation,
    updateObservation,
    deleteObservation,
    removeObservationFile,
    downloadFile,
    getFileIcon,
    isUploading
  } = useContactObservations(contact?.id || "");
  const {
    fields: extraFields,
    saveFields: saveExtraFields
  } = useContactExtraInfo(contact?.id || null, selectedWorkspace?.workspace_id || '');
  const deals: Deal[] = contactCards.map(card => ({
    id: card.id,
    title: card.title,
    description: card.description,
    value: card.value || 0,
    status: card.status,
    pipeline: card.pipeline_name,
    column_name: card.column_name
  }));
  useEffect(() => {
    if (isOpen && contact?.id && selectedWorkspace?.workspace_id) {
      const loadFreshData = async () => {
        try {
          // Query única que carrega contato + estatísticas em um único payload
          const {
            data,
            error
          } = await supabase.from('contacts').select(`
              id, 
              name, 
              phone, 
              email, 
              profile_image_url, 
              workspace_id, 
              created_at, 
              updated_at
            `).eq('id', contact.id).single();
          if (error) throw error;
          if (data) {
            setEditingContact(data as Contact);

            // Carregar estatísticas em uma única chamada com Promise.all
            const [activeConversationsResult, activeDealsResult, closedDealsResult] = await Promise.all([
            // 1. Contar conversas ativas
            supabase.from('conversations').select('*', {
              count: 'exact',
              head: true
            }).eq('contact_id', contact.id).eq('workspace_id', selectedWorkspace.workspace_id).eq('status', 'open').then(result => result.count || 0),
            // 2. Contar negócios ativos
            supabase.from('pipeline_cards').select('*', {
              count: 'exact',
              head: true
            }).eq('contact_id', contact.id).eq('status', 'aberto').then(result => result.count || 0),
            // 3. Contar negócios fechados
            supabase.from('pipeline_cards').select('*', {
              count: 'exact',
              head: true
            }).eq('contact_id', contact.id).eq('status', 'ganho').then(result => result.count || 0)]);

            // Atualizar estado com estatísticas carregadas
            setStats({
              activeConversations: activeConversationsResult,
              activeDeals: activeDealsResult,
              closedDeals: closedDealsResult
            });
          }
        } catch (error) {
          console.error('❌ Erro ao recarregar dados do contato:', error);
          setStats({
            activeConversations: 0,
            activeDeals: 0,
            closedDeals: 0
          });
        }
      };
      loadFreshData();
    }
  }, [isOpen, contact?.id, selectedWorkspace?.workspace_id]);
  useEffect(() => {
    if (extraFields.length > 0) {
      const fields = extraFields.map(field => ({
        key: field.field_name,
        value: field.field_value
      }));
      setCustomFields(fields);
    } else {
      setCustomFields([]);
    }
  }, [extraFields]);
  const handleSaveContact = async () => {
    if (!editingContact) return;
    try {
      const updateData = {
        name: editingContact.name?.trim() || '',
        email: editingContact.email?.trim() || ''
      };
      const {
        data: updatedData,
        error: updateError
      } = await supabase.from('contacts').update(updateData).eq('id', editingContact.id).select().single();
      if (updateError) throw updateError;
      const fieldsToSave = customFields.map(f => ({
        field_name: f.key,
        field_value: f.value
      }));
      await saveExtraFields(fieldsToSave);
      if (updatedData) {
        setEditingContact(updatedData as Contact);
        if (onContactUpdated) {
          onContactUpdated();
        }
      }
    } catch (error) {
      console.error('❌ Erro ao salvar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar alterações",
        variant: "destructive"
      });
    }
  };
  const handleAddCustomField = async () => {
    if (!newCustomField.key.trim() || !newCustomField.value.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome do campo e o valor",
        variant: "destructive"
      });
      return;
    }
    const fieldExists = customFields.some(field => field.key.toLowerCase() === newCustomField.key.trim().toLowerCase());
    if (fieldExists) {
      toast({
        title: "Erro",
        description: "Este campo já existe. Use um nome diferente.",
        variant: "destructive"
      });
      return;
    }
    const newFields = [...customFields, {
      key: newCustomField.key.trim(),
      value: newCustomField.value.trim()
    }];
    setCustomFields(newFields);
    const fieldsToSave = newFields.map(f => ({
      field_name: f.key,
      field_value: f.value
    }));
    await saveExtraFields(fieldsToSave);
    setNewCustomField({
      key: '',
      value: ''
    });
  };
  const handleRemoveCustomField = async (index: number) => {
    const newFields = customFields.filter((_, i) => i !== index);
    setCustomFields(newFields);
    const fieldsToSave = newFields.map(f => ({
      field_name: f.key,
      field_value: f.value
    }));
    await saveExtraFields(fieldsToSave);
  };
  const updateCustomField = (index: number, key: string, value: string) => {
    setCustomFields(customFields.map((field, i) => i === index ? {
      ...field,
      [key]: value
    } : field));
  };
  const handleSaveCustomFields = async () => {
    const fieldsToSave = customFields.map(f => ({
      field_name: f.key,
      field_value: f.value
    }));
    await saveExtraFields(fieldsToSave);
  };
  const handleAddObservation = async () => {
    if (!newObservation.trim()) return;
    const success = await addObservation(newObservation, selectedFile || undefined);
    if (success) {
      setNewObservation("");
      setSelectedFile(null);
      if (fileInputRef) {
        fileInputRef.value = '';
      }
    }
  };
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 10MB permitido.",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };
  const handleEditObservation = (obs: ContactObservation) => {
    setEditingObservationId(obs.id);
    setEditingContent(obs.content);
    setEditingFile(null);
  };
  const handleSaveEdit = async () => {
    if (!editingObservationId) return;
    const success = await updateObservation(editingObservationId, editingContent, editingFile);
    if (success) {
      setEditingObservationId(null);
      setEditingContent('');
      setEditingFile(null);
    }
  };
  const handleRemoveFile = async (observationId: string) => {
    const success = await removeObservationFile(observationId);
    if (success && editingObservationId === observationId) {
      setEditingObservationId(null);
    }
  };
  const handleCancelEdit = () => {
    setEditingObservationId(null);
    setEditingContent('');
    setEditingFile(null);
  };
  const handleSaveDealTitle = async (dealId: string) => {
    if (!editingDealTitle.trim()) {
      toast({
        title: "Erro",
        description: "O título não pode estar vazio",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.from('pipeline_cards').update({
        title: editingDealTitle
      }).eq('id', dealId);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Título atualizado"
      });
    } catch (error) {
      console.error('Erro ao salvar título:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar título",
        variant: "destructive"
      });
    }
  };
  const handleConfirmDelete = async () => {
    if (!deletingObservationId) return;
    await deleteObservation(deletingObservationId);
    setDeletingObservationId(null);
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const handleFileClick = (fileUrl: string, fileName: string, fileType?: string) => {
    setViewingMedia({
      url: fileUrl,
      type: fileType || '',
      name: fileName
    });
  };
  const getFileType = (fileName: string, fileType?: string): 'image' | 'pdf' | 'video' | 'audio' | 'other' => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    if (fileType?.includes('pdf') || extension === 'pdf') {
      return 'pdf';
    }
    if (fileType?.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) {
      return 'video';
    }
    if (fileType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) {
      return 'audio';
    }
    return 'other';
  };
  const getFieldIcon = (fieldKey: string) => {
    const key = fieldKey.toLowerCase();
    if (key.includes('email') || key.includes('e-mail')) {
      return <Mail className="h-4 w-4" />;
    }
    if (key.includes('telefone') || key.includes('phone') || key.includes('celular')) {
      return <Phone className="h-4 w-4" />;
    }
    if (key.includes('cep') || key.includes('zip')) {
      return <MapPin className="h-4 w-4" />;
    }
    if (key.includes('endereço') || key.includes('address') || key.includes('rua')) {
      return <Home className="h-4 w-4" />;
    }
    if (key.includes('perfil') || key.includes('tipo') || key.includes('categoria')) {
      return <User className="h-4 w-4" />;
    }
    if (key.includes('país') || key.includes('country') || key.includes('estado')) {
      return <Globe className="h-4 w-4" />;
    }
    if (key.includes('cpf') || key.includes('cnpj') || key.includes('documento')) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };
  if (!contact) return null;
  return <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[500px] sm:w-[540px] p-0">
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1">
              <div className="space-y-0">
                {/* ===== HEADER: Topo com gradiente pastel ===== */}
                <div className="relative overflow-hidden pb-10 pt-8" style={editingContact?.profile_image_url ? {
                backgroundImage: `url(${editingContact.profile_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : undefined}>
                  {/* Overlay com blur e gradiente pastel */}
              <div className="absolute inset-0 bg-black/40" style={{
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)'
                }} />
                  
                  {/* Conteúdo com z-index elevado */}
                  <div className="relative z-10">
                    <div className="flex flex-col items-center">
                      {/* Avatar grande com borda e sombra */}
                      <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                        {editingContact?.profile_image_url && <AvatarImage src={editingContact.profile_image_url} alt={editingContact.name || 'Contato'} className="object-cover" />}
                        <AvatarFallback className="text-2xl font-semibold" style={{
                        backgroundColor: getAvatarColor(editingContact?.name || 'Contato')
                      }}>
                          {getInitials(editingContact?.name || 'Contato')}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Nome - editável ao duplo clique com underline */}
                      {isEditingName ? <input type="text" value={editingContact?.name || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      name: e.target.value
                    } : null)} onBlur={async () => {
                      setIsEditingName(false);
                      await handleSaveContact();
                    }} onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setIsEditingName(false);
                        handleSaveContact();
                      }
                    }} autoFocus className="text-xl font-bold text-center bg-transparent border-none outline-none border-b-2 border-primary mt-3 pb-0.5 text-gray-900" /> : <h2 onDoubleClick={() => setIsEditingName(true)} title="Clique duas vezes para editar" className="text-xl font-bold mt-3 cursor-pointer transition-colors text-slate-50">
                          {editingContact?.name || 'Nome do contato'}
                        </h2>}
                      
                      {/* Telefone - somente leitura */}
                      <p className="text-sm mt-1 text-slate-300">
                        {editingContact?.phone || 'Sem telefone'}
                      </p>
                      
                      {/* Email - editável ao duplo clique com underline */}
                      {isEditingEmail ? <input type="email" value={editingContact?.email || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      email: e.target.value
                    } : null)} onBlur={async () => {
                      setIsEditingEmail(false);
                      await handleSaveContact();
                    }} onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setIsEditingEmail(false);
                        handleSaveContact();
                      }
                    }} autoFocus className="text-sm text-center bg-transparent border-none outline-none border-b-2 border-primary mt-1 pb-0.5 text-gray-900" /> : <p onDoubleClick={() => setIsEditingEmail(true)} className="text-sm text-gray-900 mt-1 cursor-pointer hover:text-gray-700 transition-colors" title="Clique duas vezes para editar">
                          {editingContact?.email || 'Adicionar email'}
                        </p>}
                    </div>
                  </div>
                </div>

                {/* ===== ESTATÍSTICAS: 3 colunas lado a lado ===== */}
                <div className="border-b bg-white px-6 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* Conversas Ativas */}
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                        <MessageCircle className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeConversations}</p>
                      <p className="text-xs text-gray-500 font-medium">Conversas Ativas</p>
                    </div>

                    {/* Negócios Ativos */}
                    <div className="flex flex-col items-center justify-center space-y-1 border-x border-gray-200">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
                        <Briefcase className="h-5 w-5 text-amber-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeDeals}</p>
                      <p className="text-xs text-gray-500 font-medium">Negócios Ativos</p>
                    </div>

                    {/* Negócios Fechados */}
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                        <Trophy className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{stats.closedDeals}</p>
                      <p className="text-xs text-gray-500 font-medium">Negócios Fechados</p>
                    </div>
                  </div>
                </div>

                {/* ===== CORPO: Blocos organizados ===== */}
                <div className="p-4 space-y-4">
                  {/* BLOCO 1: Informações Adicionais */}
                  <Card className="border rounded-xl shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" />
                        Informações Adicionais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Lista de campos existentes - Cards compactos */}
                      <div className="space-y-3">
                        {customFields.map((field, index) => <div key={index} className="group relative p-4 bg-muted/30 border border-border/40 rounded-lg hover:shadow-sm transition-all">
                            <div className="flex items-start gap-3">
                              {/* Ícone dinâmico */}
                              <div className="mt-0.5 text-muted-foreground">
                                {getFieldIcon(field.key)}
                              </div>
                              
                              <div className="flex-1 space-y-1 min-w-0">
                                {/* Label do campo - EDITÁVEL com double-click */}
                                {editingFieldIndex === index && editingFieldType === 'key' ? <input type="text" value={field.key} onChange={e => updateCustomField(index, 'key', e.target.value)} onBlur={async () => {
                              setEditingFieldIndex(null);
                              setEditingFieldType(null);
                              await handleSaveCustomFields();
                            }} onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }} autoFocus className="w-full text-xs font-bold uppercase tracking-wide bg-transparent border-none outline-none border-b-2 border-primary pb-0.5" /> : <p className="text-xs font-bold uppercase tracking-wide truncate cursor-pointer" onDoubleClick={() => {
                              setEditingFieldIndex(index);
                              setEditingFieldType('key');
                            }} title="Clique duas vezes para editar">
                                    {field.key}
                                  </p>}
                                
                                {/* Valor editável com underline inline */}
                                {editingFieldIndex === index && editingFieldType === 'value' ? <input type="text" value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)} onBlur={async () => {
                              setEditingFieldIndex(null);
                              setEditingFieldType(null);
                              await handleSaveCustomFields();
                            }} onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }} autoFocus className="w-full text-sm font-normal bg-transparent border-none outline-none border-b-2 border-primary pb-0.5" /> : <p onDoubleClick={() => {
                              setEditingFieldIndex(index);
                              setEditingFieldType('value');
                            }} className="text-sm font-normal text-muted-foreground cursor-pointer truncate" title="Clique duas vezes para editar">
                                    {field.value || 'Clique para adicionar'}
                                  </p>}
                              </div>
                              
                              {/* Botão delete - visível apenas no hover */}
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={() => handleRemoveCustomField(index)}>
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>)}
                      </div>

                      {/* Adicionar novo campo */}
                      <div className="border-t pt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Nome do campo" value={newCustomField.key} onChange={e => setNewCustomField(prev => ({
                          ...prev,
                          key: e.target.value
                        }))} className="text-sm h-9" />
                          <Input placeholder="Valor" value={newCustomField.value} onChange={e => setNewCustomField(prev => ({
                          ...prev,
                          value: e.target.value
                        }))} className="text-sm h-9" />
                        </div>
                        <Button variant="outline" size="sm" className="w-full" onClick={handleAddCustomField} disabled={!newCustomField.key.trim() || !newCustomField.value.trim()}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar campo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* BLOCO 2: Pipeline / Negócios */}
                  <Card className="border rounded-xl shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-green-500" />
                          Pipeline
                        </CardTitle>
                        <Button size="sm" variant="ghost" onClick={() => setIsCreateDealModalOpen(true)} className="h-8">
                          <Plus className="h-3 w-3 mr-1" /> Vincular
                        </Button>
                      </div>
                    </CardHeader>
              <CardContent>
                {cardsLoading ? <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div> : deals.length > 0 ? <div className="grid grid-cols-2 gap-3">
                    {deals.map(deal => <div key={deal.id} className="p-4 bg-gradient-to-br from-muted/40 to-muted/20 border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="space-y-2">
                          {editingDealId === deal.id ? <input type="text" value={editingDealTitle} onChange={e => setEditingDealTitle(e.target.value)} onBlur={async () => {
                            await handleSaveDealTitle(deal.id);
                            setEditingDealId(null);
                          }} onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }} autoFocus className="w-full font-bold text-sm bg-transparent border-none outline-none border-b-2 border-primary pb-0.5" /> : <div className="flex items-center gap-2" onDoubleClick={() => {
                            setEditingDealId(deal.id);
                            setEditingDealTitle(deal.pipeline);
                          }}>
                              <Briefcase className="h-4 w-4 text-primary flex-shrink-0" />
                              <h4 className="font-bold text-sm cursor-pointer" title="Clique duas vezes para editar">
                                {deal.pipeline}
                              </h4>
                            </div>}

                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-primary/60" />
                            <p className="text-xs text-muted-foreground">
                              {deal.column_name}
                            </p>
                          </div>

                          <div className="pt-1 border-t border-border/30">
                            <p className="text-sm font-normal text-muted-foreground">
                              {formatCurrency(deal.value)}
                            </p>
                          </div>
                        </div>
                      </div>)}
                  </div> : <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-2">
                      <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum negócio vinculado
                      </p>
                    </div>
                  </div>}
              </CardContent>
                  </Card>

                  {/* BLOCO 3: Observações */}
                  <Card className="border rounded-xl shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-500" />
                        Observações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Lista de observações */}
                      <ScrollArea className="h-48">
                        <div className="space-y-3 pr-4">
                          {realObservations.map(obs => <div key={obs.id} className="p-3 bg-muted/30 rounded-lg group">
                              {editingObservationId === obs.id ? <div className="space-y-2">
                                  <Textarea value={editingContent} onChange={e => setEditingContent(e.target.value)} className="min-h-[80px]" />
                                  
                                  {/* Mostrar arquivo existente */}
                                  {obs.file_name && obs.file_url && !editingFile && <div className="flex items-center justify-between p-2 bg-muted rounded">
                                      <button onClick={() => handleFileClick(obs.file_url!, obs.file_name!, obs.file_type)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                        <Paperclip className="h-3 w-3" />
                                        {obs.file_name}
                                      </button>
                                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => handleRemoveFile(obs.id)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>}

                                  {/* Input para novo arquivo */}
                                  <div className="flex items-center gap-2">
                                    <input ref={editingFileInputRef} type="file" onChange={e => setEditingFile(e.target.files?.[0] || null)} className="hidden" />
                                    <Button type="button" size="sm" variant="outline" onClick={() => editingFileInputRef.current?.click()} className="flex items-center gap-2">
                                      <Paperclip className="h-4 w-4" />
                                      {editingFile ? editingFile.name : 'Anexar arquivo'}
                                    </Button>
                                    
                                    {editingFile && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingFile(null)}>
                                        <X className="h-4 w-4" />
                                      </Button>}
                                  </div>

                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveEdit} disabled={isUploading}>
                                      {isUploading ? 'Salvando...' : 'Salvar'}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div> : <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm">{obs.content}</p>
                                    {obs.file_name && obs.file_url && <div className="mt-2">
                                        <button onClick={() => handleFileClick(obs.file_url!, obs.file_name!, obs.file_type)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                          <Paperclip className="h-3 w-3" />
                                          {obs.file_name}
                                        </button>
                                      </div>}
                                    <span className="text-xs text-muted-foreground block mt-1">
                                      {formatDate(obs.created_at)}
                                    </span>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditObservation(obs)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => setDeletingObservationId(obs.id)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>}
                            </div>)}
                          {realObservations.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhuma observação encontrada
                            </p>}
                        </div>
                        <ScrollBar orientation="vertical" />
                      </ScrollArea>

                      {/* Campo para nova observação */}
                      <div className="space-y-2 border-t pt-3">
                        <Textarea placeholder="Digite uma observação..." value={newObservation} onChange={e => setNewObservation(e.target.value)} className="min-h-[60px] text-sm" />
                        {selectedFile && <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                            <span>{getFileIcon(selectedFile.type)}</span>
                            <span>{selectedFile.name}</span>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} className="h-4 w-4 p-0 ml-auto">
                              ✕
                            </Button>
                          </div>}
                        <div className="flex gap-2">
                          <input type="file" ref={setFileInputRef} onChange={handleFileSelect} className="hidden" accept="*/*" />
                          <Button variant="outline" size="sm" onClick={() => fileInputRef?.click()} disabled={isUploading}>
                            <Paperclip className="h-3 w-3 mr-1" /> Anexar
                          </Button>
                          <Button size="sm" className="flex-1" onClick={handleAddObservation} disabled={!newObservation.trim() || isUploading}>
                            {isUploading ? "Enviando..." : "Adicionar"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Botão Salvar */}
                  <Button onClick={handleSaveContact} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                    Salvar
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={!!deletingObservationId} onOpenChange={() => setDeletingObservationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta observação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Criar Negócio */}
      <CriarNegocioModal open={isCreateDealModalOpen} onOpenChange={setIsCreateDealModalOpen} preSelectedContactId={contact.id} preSelectedContactName={contact.name} />

      {/* Modais de visualização de mídia */}
      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'image' && <ImageModal isOpen={true} onClose={() => setViewingMedia(null)} imageUrl={viewingMedia.url} fileName={viewingMedia.name} />}

      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'pdf' && <PdfModal isOpen={true} onClose={() => setViewingMedia(null)} pdfUrl={viewingMedia.url} fileName={viewingMedia.name} />}

      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'video' && <VideoModal isOpen={true} onClose={() => setViewingMedia(null)} videoUrl={viewingMedia.url} fileName={viewingMedia.name} />}
    </>;
}