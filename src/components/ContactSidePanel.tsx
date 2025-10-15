import { useState, useEffect } from "react";
import { User, Briefcase, FileText, Paperclip, Pencil, Trash2, Plus, Pin, MapPin } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [newCustomField, setNewCustomField] = useState({ key: '', value: '' });
  const [newObservation, setNewObservation] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null);
  const [isCreateDealModalOpen, setIsCreateDealModalOpen] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingFieldType, setEditingFieldType] = useState<'key' | 'value' | null>(null);

  const { pipelines } = usePipelines();
  const { columns, fetchColumns } = usePipelineColumns(null);
  const { cards: contactCards, currentPipeline, transferToPipeline, isLoading: cardsLoading } = useContactPipelineCards(contact?.id || null);
  const { createCard } = usePipelineCards(null);
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const { observations: realObservations, addObservation, updateObservation, deleteObservation, downloadFile, getFileIcon, isUploading } = useContactObservations(contact?.id || "");
  const { fields: extraFields, saveFields: saveExtraFields } = useContactExtraInfo(contact?.id || null, selectedWorkspace?.workspace_id || '');

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
    if (isOpen && contact?.id) {
      const loadFreshData = async () => {
        try {
          const { data, error } = await supabase
            .from('contacts')
            .select('id, name, phone, email, profile_image_url, workspace_id, created_at, updated_at')
            .eq('id', contact.id)
            .single();

          if (error) throw error;
          if (data) {
            setEditingContact(data as Contact);
          }
        } catch (error) {
          console.error('❌ Erro ao recarregar dados do contato:', error);
        }
      };
      loadFreshData();
    }
  }, [isOpen, contact?.id]);

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

      const { data: updatedData, error: updateError } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', editingContact.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const fieldsToSave = customFields.map(f => ({
        field_name: f.key,
        field_value: f.value
      }));

      const saveSuccess = await saveExtraFields(fieldsToSave);
      
      if (saveSuccess) {
        toast({
          title: "Sucesso",
          description: "Dados salvos com sucesso!"
        });
      }

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
    setNewCustomField({ key: '', value: '' });
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
    setCustomFields(customFields.map((field, i) => 
      i === index ? { ...field, [key]: value } : field
    ));
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
  };

  const handleSaveEdit = async () => {
    if (!editingObservationId) return;
    const success = await updateObservation(editingObservationId, editingContent);
    if (success) {
      setEditingObservationId(null);
      setEditingContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingObservationId(null);
    setEditingContent('');
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

  if (!contact) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[500px] sm:w-[540px] p-0">
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1">
              <div className="space-y-0">
                {/* ===== HEADER: Topo com gradiente pastel ===== */}
                <div className="relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pb-8 pt-6">
                  <div className="flex flex-col items-center">
                    {/* Avatar grande com borda e sombra */}
                    <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                      {editingContact?.profile_image_url && (
                        <AvatarImage 
                          src={editingContact.profile_image_url} 
                          alt={editingContact.name || 'Contato'}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback 
                        className="text-2xl font-semibold"
                        style={{ 
                          backgroundColor: getAvatarColor(editingContact?.name || 'Contato')
                        }}
                      >
                        {getInitials(editingContact?.name || 'Contato')}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Nome - editável ao duplo clique */}
                    {isEditingName ? (
                      <Input 
                        type="text"
                        value={editingContact?.name || ''} 
                        onChange={(e) => setEditingContact(prev => prev ? {
                          ...prev,
                          name: e.target.value
                        } : null)}
                        onBlur={async () => {
                          setIsEditingName(false);
                          await handleSaveContact();
                        }}
                        autoFocus
                        className="text-xl font-bold text-center border rounded px-3 py-1 mt-3 max-w-xs bg-white shadow-sm"
                      />
                    ) : (
                      <h2
                        onDoubleClick={() => setIsEditingName(true)}
                        className="text-xl font-bold text-gray-900 mt-3 cursor-pointer hover:text-gray-700 transition-colors"
                        title="Clique duas vezes para editar"
                      >
                        {editingContact?.name || 'Nome do contato'}
                      </h2>
                    )}
                    
                    {/* Telefone - somente leitura */}
                    <p className="text-sm text-gray-600 mt-1">
                      {editingContact?.phone || 'Sem telefone'}
                    </p>
                    
                    {/* Email - editável ao duplo clique */}
                    {isEditingEmail ? (
                      <Input 
                        type="email"
                        value={editingContact?.email || ''} 
                        onChange={(e) => setEditingContact(prev => prev ? {
                          ...prev,
                          email: e.target.value
                        } : null)}
                        onBlur={async () => {
                          setIsEditingEmail(false);
                          await handleSaveContact();
                        }}
                        autoFocus
                        className="text-sm text-center border rounded px-3 py-1 mt-1 max-w-xs bg-white shadow-sm"
                      />
                    ) : (
                      <p
                        onDoubleClick={() => setIsEditingEmail(true)}
                        className="text-sm text-blue-600 mt-1 cursor-pointer hover:underline transition-colors"
                        title="Clique duas vezes para editar"
                      >
                        {editingContact?.email || 'Adicionar email'}
                      </p>
                    )}
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
                      {/* Lista de campos existentes */}
                      <div className="grid grid-cols-2 gap-3">
                        {customFields.map((field, index) => (
                          <div key={index} className="space-y-1">
                            {/* Título do campo - EDITÁVEL */}
                            {editingFieldIndex === index && editingFieldType === 'key' ? (
                              <Input
                                value={field.key}
                                onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                                onBlur={async () => {
                                  setEditingFieldIndex(null);
                                  setEditingFieldType(null);
                                  await handleSaveCustomFields();
                                }}
                                autoFocus
                                className="text-xs uppercase tracking-wide font-medium"
                              />
                            ) : (
                              <Label 
                                onDoubleClick={() => {
                                  setEditingFieldIndex(index);
                                  setEditingFieldType('key');
                                }}
                                className="text-xs text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors"
                                title="Clique duas vezes para editar"
                              >
                                {field.key}
                              </Label>
                            )}
                            
                            {/* Valor do campo - EDITÁVEL */}
                            <div className="flex items-center gap-2">
                              <Input
                                value={field.value}
                                onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                                onBlur={async () => {
                                  await handleSaveCustomFields();
                                }}
                                onDoubleClick={() => {
                                  setEditingFieldIndex(index);
                                  setEditingFieldType('value');
                                }}
                                className="text-sm font-medium flex-1"
                                title="Edite e pressione Enter ou clique fora para salvar"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                onClick={() => handleRemoveCustomField(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Adicionar novo campo */}
                      <div className="border-t pt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome do campo"
                            value={newCustomField.key}
                            onChange={e => setNewCustomField(prev => ({ ...prev, key: e.target.value }))}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Valor"
                            value={newCustomField.value}
                            onChange={e => setNewCustomField(prev => ({ ...prev, value: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={handleAddCustomField}
                          disabled={!newCustomField.key.trim() || !newCustomField.value.trim()}
                        >
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsCreateDealModalOpen(true)}
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Vincular
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {deals.length > 0 ? (
                        deals.map(deal => (
                          <div key={deal.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                            <Avatar className="h-10 w-10">
                              {editingContact?.profile_image_url && (
                                <AvatarImage src={editingContact.profile_image_url} alt={editingContact.name} className="object-cover" />
                              )}
                              <AvatarFallback className="text-white font-medium" style={{ backgroundColor: getAvatarColor(editingContact?.name || '') }}>
                                {getInitials(editingContact?.name || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{deal.pipeline} - {deal.column_name}</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(deal.value)}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhum negócio vinculado
                        </p>
                      )}
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
                      <ScrollArea className="max-h-48">
                        <div className="space-y-3 pr-2">
                          {realObservations.map(obs => (
                            <div key={obs.id} className="p-3 bg-muted/30 rounded-lg group">
                              {editingObservationId === obs.id ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingContent}
                                    onChange={e => setEditingContent(e.target.value)}
                                    className="min-h-[80px]"
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveEdit}>
                                      Salvar
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm">{obs.content}</p>
                                    {obs.file_name && obs.file_url && (
                                      <div className="mt-2">
                                        <button
                                          onClick={() => handleFileClick(obs.file_url!, obs.file_name!, obs.file_type)}
                                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                          <Paperclip className="h-3 w-3" />
                                          {obs.file_name}
                                        </button>
                                      </div>
                                    )}
                                    <span className="text-xs text-muted-foreground block mt-1">
                                      {formatDate(obs.created_at)}
                                    </span>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handleEditObservation(obs)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-red-600 hover:text-red-700"
                                      onClick={() => setDeletingObservationId(obs.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {realObservations.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhuma observação encontrada
                            </p>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Campo para nova observação */}
                      <div className="space-y-2 border-t pt-3">
                        <Textarea
                          placeholder="Digite uma observação..."
                          value={newObservation}
                          onChange={e => setNewObservation(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                        {selectedFile && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                            <span>{getFileIcon(selectedFile.type)}</span>
                            <span>{selectedFile.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedFile(null)}
                              className="h-4 w-4 p-0 ml-auto"
                            >
                              ✕
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="file"
                            ref={setFileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="*/*"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef?.click()}
                            disabled={isUploading}
                          >
                            <Paperclip className="h-3 w-3 mr-1" /> Anexar
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={handleAddObservation}
                            disabled={!newObservation.trim() || isUploading}
                          >
                            {isUploading ? "Enviando..." : "Adicionar"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Botão Salvar */}
                  <Button
                    onClick={handleSaveContact}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                  >
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
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Criar Negócio */}
      <CriarNegocioModal
        open={isCreateDealModalOpen}
        onOpenChange={setIsCreateDealModalOpen}
        preSelectedContactId={contact.id}
        preSelectedContactName={contact.name}
      />

      {/* Modais de visualização de mídia */}
      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'image' && (
        <ImageModal
          isOpen={true}
          onClose={() => setViewingMedia(null)}
          imageUrl={viewingMedia.url}
          fileName={viewingMedia.name}
        />
      )}

      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'pdf' && (
        <PdfModal
          isOpen={true}
          onClose={() => setViewingMedia(null)}
          pdfUrl={viewingMedia.url}
          fileName={viewingMedia.name}
        />
      )}

      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'video' && (
        <VideoModal
          isOpen={true}
          onClose={() => setViewingMedia(null)}
          videoUrl={viewingMedia.url}
          fileName={viewingMedia.name}
        />
      )}
    </>
  );
}
