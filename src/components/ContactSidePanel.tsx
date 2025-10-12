import { useState, useEffect } from "react";
import contactBackground from "@/assets/contact-background.png";
import { X, Upload, FileText, Paperclip, Pencil, Trash2, Star, Plus, Pin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
interface Observation {
  id: string;
  content: string;
  created_at: string;
  attachment_url?: string;
  attachment_name?: string;
}
interface ContactSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onContactUpdated?: () => void;
}

// Função auxiliar para obter iniciais
const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Função auxiliar para cor do avatar
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
  const [pinnedFields, setPinnedFields] = useState<string[]>([]);
  const [newObservation, setNewObservation] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null);
  const [isCreateDealModalOpen, setIsCreateDealModalOpen] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  // Hook para buscar pipelines reais
  const {
    pipelines,
    isLoading: pipelinesLoading
  } = usePipelines();

  // Hook para buscar colunas do pipeline selecionado
  const {
    columns,
    fetchColumns
  } = usePipelineColumns(null);

  // Hook para buscar cards do contato
  const {
    cards: contactCards,
    currentPipeline,
    transferToPipeline,
    isLoading: cardsLoading
  } = useContactPipelineCards(contact?.id || null);

  // Hook para criar cards
  const {
    createCard
  } = usePipelineCards(null);

  // Hook para toast
  const {
    toast
  } = useToast();

  // Hook para workspace
  const {
    selectedWorkspace
  } = useWorkspace();

  // Hook para observações
  const {
    observations: realObservations,
    addObservation,
    updateObservation,
    deleteObservation,
    downloadFile,
    getFileIcon,
    isUploading
  } = useContactObservations(contact?.id || "");

  // 🆕 Hook para informações extras do contato
  const {
    fields: extraFields,
    saveFields: saveExtraFields
  } = useContactExtraInfo(contact?.id || null, selectedWorkspace?.workspace_id || '');

  // Dados mockados de deals baseados nos cards do contato
  const deals: Deal[] = contactCards.map(card => ({
    id: card.id,
    title: card.title,
    description: card.description,
    value: card.value || 0,
    status: card.status,
    pipeline: card.pipeline_name,
    column_name: card.column_name
  }));
  // Recarregar dados frescos do banco ao abrir o painel
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
            console.log('✅ Dados frescos carregados:', data);
            setEditingContact(data as Contact);
          }
        } catch (error) {
          console.error('❌ Erro ao recarregar dados do contato:', error);
        }
      };

      loadFreshData();
    }
  }, [isOpen, contact?.id]);

  // 🆕 useEffect separado para converter extraFields em customFields
  useEffect(() => {
    if (extraFields.length > 0) {
      console.log('📋 Convertendo extraFields para customFields:', extraFields);
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
    console.log('🚀 handleSaveContact CHAMADA!');
    if (!editingContact) {
      console.log('⚠️ editingContact é null/undefined');
      return;
    }
    console.log('🔍 Estado editingContact antes de salvar:', editingContact);
    try {
      const {
        supabase
      } = await import('@/integrations/supabase/client');

      // 1️⃣ Salvar dados básicos do contato
      const updateData = {
        name: editingContact.name?.trim() || '',
        email: editingContact.email?.trim() || ''
        // phone removido - não pode ser alterado para preservar histórico
      };
      console.log('📤 Salvando dados básicos:', updateData);
      const {
        data: updatedData,
        error: updateError
      } = await supabase.from('contacts').update(updateData).eq('id', editingContact.id).select().single();
      if (updateError) {
        console.error('❌ Erro ao atualizar contato:', updateError);
        toast({
          title: "Erro",
          description: "Erro ao salvar dados do contato",
          variant: "destructive"
        });
        throw updateError;
      }
      console.log('✅ Dados básicos salvos:', updatedData);

      // 2️⃣ Salvar informações extras usando a nova tabela
      const fieldsToSave = customFields.map(f => ({
        field_name: f.key,
        field_value: f.value
      }));
      console.log('📤 Salvando informações extras:', fieldsToSave);
      const saveSuccess = await saveExtraFields(fieldsToSave);
      if (!saveSuccess) {
        toast({
          title: "Aviso",
          description: "Dados do contato salvos, mas houve erro ao salvar informações adicionais"
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Todos os dados salvos com sucesso!"
        });
      }

      // Atualizar estado local
      if (updatedData) {
        setEditingContact(updatedData as Contact);
        
        // Notificar componente pai para recarregar lista
        if (onContactUpdated) {
          onContactUpdated();
        }
      }
    } catch (error) {
      console.error('❌ Erro geral ao salvar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar alterações",
        variant: "destructive"
      });
    }
  };
  const handlePinField = () => {
    if (!newCustomField.key.trim()) return;
    setPinnedFields(prev => [...prev, newCustomField.key.trim()]);
    setNewCustomField({ key: '', value: '' });
    toast({
      title: "Campo fixado",
      description: "Agora você pode preencher o valor quando precisar"
    });
  };

  const removePinnedField = (index: number) => {
    setPinnedFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomField = () => {
    if (!newCustomField.key.trim() || !newCustomField.value.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome do campo e o valor",
        variant: "destructive"
      });
      return;
    }

    // Verificar se o campo já existe
    const fieldExists = customFields.some(field => field.key.toLowerCase() === newCustomField.key.trim().toLowerCase());
    if (fieldExists) {
      toast({
        title: "Erro",
        description: "Este campo já existe. Use um nome diferente.",
        variant: "destructive"
      });
      return;
    }
    setCustomFields([...customFields, {
      key: newCustomField.key.trim(),
      value: newCustomField.value.trim()
    }]);
    setNewCustomField({
      key: '',
      value: ''
    });
    toast({
      title: "Sucesso",
      description: "Campo adicionado com sucesso!"
    });
  };
  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
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
      // Validate file size (max 10MB)
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
  const triggerFileSelect = () => {
    fileInputRef?.click();
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
  if (!contact) return null;
  return <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:w-[540px] p-0">
        <div className="flex flex-col h-full">
          {/* Cabeçalho removido - card ocupa todo espaço */}

          <ScrollArea className="flex-1">
            <div className="space-y-6">
              {/* Seção: Negócios - Movido para o topo */}
              {deals.length > 0}

              {/* Seção: Dados do contato */}
            <Card className="border-0 shadow-none rounded-none overflow-hidden">
              <CardContent className="p-0">
    {/* Banner Header com todas informações dentro */}
    <div className="relative h-48 bg-cover bg-center" 
         style={{ backgroundImage: `url(${contactBackground})` }}>
                  {/* Overlay para legibilidade */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/50" />
                  
                  {/* Conteúdo sobre o banner */}
                  <div className="relative z-10 flex flex-col items-center pt-4">
                    {/* Avatar */}
                    <Avatar className="h-20 w-20 border-3 border-white shadow-lg">
                      {editingContact?.profile_image_url && (
                        <AvatarImage 
                          src={editingContact.profile_image_url} 
                          alt={editingContact.name || 'Contato'}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback 
                        className="text-lg font-semibold"
                        style={{ 
                          backgroundColor: getAvatarColor(editingContact?.name || 'Contato')
                        }}
                      >
                        {getInitials(editingContact?.name || 'Contato')}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Nome */}
                    <h2 className="text-white text-base font-semibold drop-shadow-lg mt-2">
                      {editingContact?.name || 'Nome do contato'}
                    </h2>
                    
                    {/* Email editável */}
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
                        className="text-sm text-center border rounded px-2 py-1 max-w-xs bg-white/90 mt-1"
                      />
                    ) : (
                      <p
                        onDoubleClick={() => setIsEditingEmail(true)}
                        className="text-white/90 text-sm drop-shadow-md cursor-pointer hover:underline mt-1"
                        title="Clique duas vezes para editar"
                      >
                        {editingContact?.email || 'Adicionar email'}
                      </p>
                    )}
                  </div>
                </div>

                  {/* Informações adicionais integradas */}
                  <div className="space-y-3 pt-2 px-6">
                    <h4 className="text-sm font-semibold">Informações adicionais</h4>
                    
                    {/* Lista de campos fixados (só nome, sem valor) */}
                    {pinnedFields.map((fieldName, index) => (
                      <div key={`pinned-${index}`} className="flex gap-2 items-center">
                        <Pin className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        <Input 
                          value={fieldName} 
                          readOnly
                          className="flex-1 font-medium bg-muted text-sm"
                        />
                        <Input 
                          placeholder="Preencher valor..." 
                          className="flex-1 text-sm"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePinnedField(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {/* Lista de campos completos (nome + valor) */}
                    {customFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Pin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input 
                          value={field.key} 
                          readOnly 
                          className="flex-1 text-sm font-medium border-0 bg-transparent px-0"
                        />
                        <Input 
                          value={field.value} 
                          readOnly 
                          className="flex-1 text-sm border-0 bg-transparent px-0"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveCustomField(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {/* Inputs para adicionar novo campo */}
                    <div className="flex gap-2 items-center pt-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={handlePinField}
                        disabled={!newCustomField.key.trim()}
                        className="text-yellow-500 hover:text-yellow-600 h-8 w-8"
                        title="Fixar apenas o nome do campo"
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Input 
                        placeholder="Nome do campo" 
                        value={newCustomField.key}
                        onChange={e => setNewCustomField(prev => ({...prev, key: e.target.value}))}
                        className="flex-1 text-sm"
                      />
                      <Input 
                        placeholder="Valor" 
                        value={newCustomField.value}
                        onChange={e => setNewCustomField(prev => ({...prev, value: e.target.value}))}
                        className="flex-1 text-sm"
                      />
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={handleAddCustomField}
                        disabled={!newCustomField.key.trim() || !newCustomField.value.trim()}
                        className="text-green-600 hover:text-green-700 h-8 w-8"
                        title="Adicionar campo completo"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Negócios */}
                  {deals.length > 0 ? <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Negócios</Label>
                        <Button size="sm" variant="outline" onClick={() => setIsCreateDealModalOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Novo negócio
                        </Button>
                      </div>

                      {/* Lista de todos os negócios */}
                      <div className="space-y-3">
                        {deals.map(deal => (
                          <div key={deal.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            {/* Avatar do cliente */}
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={editingContact?.profile_image_url} alt={editingContact?.name} className="object-cover" />
                              <AvatarFallback className="text-white font-medium" style={{
                                backgroundColor: getAvatarColor(editingContact?.name || '')
                              }}>
                                {getInitials(editingContact?.name || '')}
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* Informações do negócio */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {deal.pipeline} - {deal.column_name}
                              </p>
                              <p className="text-sm font-semibold text-primary">
                                {formatCurrency(deal.value)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div> : <div className="space-y-2">
                      <Label htmlFor="pipeline" className="text-sm font-medium">Pipeline</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-sm text-muted-foreground">
                          Nenhum pipeline vinculado
                        </div>
                        <Button size="icon" variant="outline" className="h-9 w-9 flex-shrink-0" onClick={() => setIsCreateDealModalOpen(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>}

                  {/* Botão Salvar */}
                  <Button type="button" onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔴 BOTÃO CLICADO!');
                  handleSaveContact();
                }} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                    Salvar
                  </Button>
                </CardContent>
              </Card>

              {/* Seção: Negócios */}
              {deals.length > 0}

              {/* Seção: Observações */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Observações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de observações */}
                  <ScrollArea className="max-h-32">
                    <div className="space-y-3 pr-4">
                      {realObservations.map(obs => <div key={obs.id} className="p-3 bg-muted rounded-lg group">
                          {editingObservationId === obs.id ?
                      // Modo de edição
                      <div className="space-y-2">
                              <Textarea value={editingContent} onChange={e => setEditingContent(e.target.value)} className="min-h-[80px] border-yellow-500 focus:border-yellow-600" />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveEdit} className="text-xs">
                                  Salvar
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancelEdit} className="text-xs">
                                  Cancelar
                                </Button>
                              </div>
                            </div> :
                      // Modo de visualização
                      <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm">{obs.content}</p>
                                {obs.file_name && obs.file_url && <div className="mt-2">
                                    <button onClick={() => downloadFile(obs.file_url!, obs.file_name!)} className="text-xs text-muted-foreground cursor-pointer hover:text-primary flex items-center gap-1">
                                      <span>{getFileIcon(obs.file_type)}</span>
                                      {obs.file_name}
                                    </button>
                                  </div>}
                                <span className="text-xs text-muted-foreground block mt-1">
                                  {formatDate(obs.created_at)}
                                </span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" onClick={() => handleEditObservation(obs)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeletingObservationId(obs.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>}
                        </div>)}
                      {realObservations.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma observação encontrada
                        </p>}
                     </div>
                  </ScrollArea>

                  {/* Adicionar nova observação */}
                  <div className="space-y-2">
                    <Textarea placeholder="Digite uma observação..." value={newObservation} onChange={e => setNewObservation(e.target.value)} className="min-h-[80px]" />
                    
                    {/* Preview do arquivo selecionado */}
                    {selectedFile && <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                        <span>{getFileIcon(selectedFile.type)}</span>
                        <span>{selectedFile.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} className="h-4 w-4 p-0">
                          ✕
                        </Button>
                      </div>}
                    
                    <div className="flex gap-2">
                      <input type="file" ref={setFileInputRef} onChange={handleFileSelect} className="hidden" accept="*/*" />
                      <Button variant="outline" size="sm" className="text-xs" onClick={triggerFileSelect} disabled={isUploading}>
                        📎 Anexar arquivo
                      </Button>
                      <Button size="sm" onClick={handleAddObservation} className="text-xs" disabled={!newObservation.trim() || isUploading}>
                        {isUploading ? "Enviando..." : "Adicionar"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>

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
    </Sheet>;
}