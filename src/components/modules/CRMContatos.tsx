import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Phone, MessageCircle, Edit, Trash2, User, X, Pin } from "lucide-react";
import { ContactTags } from "@/components/chat/ContactTags";
import { useContactTags } from "@/hooks/useContactTags";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ContactTagSelector } from "@/components/crm/ContactTagSelector";
import { IniciarConversaContatoModal } from "@/components/modals/IniciarConversaContatoModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProfileImageDebug } from "@/components/debug/ProfileImageDebug";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTags } from "@/hooks/useTags";
import { format } from "date-fns";
import { DeletarTicketModal } from "@/components/modals/DeletarTicketModal";
import { AdicionarTagModal } from "@/components/modals/AdicionarTagModal";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  tags: Array<{
    name: string;
    color: string;
  }>;
  avatar?: string;
  profile_image_url?: string;
  extra_info?: Record<string, any>;
}
export function CRMContatos() {
  const {
    selectedWorkspace
  } = useWorkspace();
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customFields, setCustomFields] = useState<Array<{
    name: string;
    value: string;
  }>>([]);
  const [pinnedFields, setPinnedFields] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugContact, setDebugContact] = useState<Contact | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [selectedContactForTag, setSelectedContactForTag] = useState<string | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedContactForWhatsApp, setSelectedContactForWhatsApp] = useState<Contact | null>(null);
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);
  const {
    tags
  } = useTags();
  const {
    toast
  } = useToast();

  // Fetch contacts directly from contacts table
  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      if (!selectedWorkspace) {
        console.warn('No workspace selected in CRM Contatos');
        setContacts([]);
        return;
      }

      // Get all contacts from the workspace
      const {
        data: contactsData,
        error: contactsError
      } = await supabase.from('contacts').select('*').eq('workspace_id', selectedWorkspace.workspace_id).order('created_at', {
        ascending: false
      });
      if (contactsError) throw contactsError;
      if (!contactsData || contactsData.length === 0) {
        setContacts([]);
        return;
      }
      const contactIds = contactsData.map(c => c.id);

      // Get contact tags
      const {
        data: contactTagsData,
        error: tagsError
      } = await supabase.from('contact_tags').select(`
          contact_id,
          tags:tag_id (
            id,
            name,
            color
          )
        `).in('contact_id', contactIds);
      if (tagsError) throw tagsError;

      // Map tags to contacts
      const contactsWithTags = (contactsData || []).map(contact => {
        const contactTags = contactTagsData?.filter(ct => ct.contact_id === contact.id)?.map(ct => ({
          name: ct.tags?.name || '',
          color: ct.tags?.color || '#808080'
        })) || [];
        return {
          id: contact.id,
          name: contact.name,
          phone: contact.phone || '',
          email: contact.email || '',
          createdAt: format(new Date(contact.created_at), 'dd/MM/yyyy HH:mm:ss'),
          tags: contactTags,
          profile_image_url: contact.profile_image_url,
          extra_info: contact.extra_info as Record<string, any> || {}
        };
      });
      setContacts(contactsWithTags);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchContacts();
  }, [selectedWorkspace]);

  // Real-time subscription for contacts changes
  useEffect(() => {
    if (!selectedWorkspace) return;
    const channel = supabase.channel('contacts-changes').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'contacts',
      filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`
    }, async payload => {
      const newContactData = payload.new;
      const newContact: Contact = {
        id: newContactData.id,
        name: newContactData.name,
        phone: newContactData.phone || '',
        email: newContactData.email || '',
        createdAt: format(new Date(newContactData.created_at), 'dd/MM/yyyy HH:mm:ss'),
        tags: [],
        profile_image_url: newContactData.profile_image_url,
        extra_info: newContactData.extra_info as Record<string, any> || {}
      };
      setContacts(prev => [newContact, ...prev]);
    }).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'contacts',
      filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`
    }, () => {
      // Refetch all contacts when any contact is updated
      fetchContacts();
    }).on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'contacts',
      filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`
    }, payload => {
      const deletedId = payload.old.id;
      setContacts(prev => prev.filter(c => c.id !== deletedId));
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace]);

  // Filter contacts based on search and tag filter
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || contact.phone.includes(searchTerm);
    
    // Se nenhuma tag está selecionada, mostra todos os contatos
    if (selectedTagIds.length === 0) {
      return matchesSearch;
    }
    
    // Se tags estão selecionadas, o contato deve ter pelo menos uma das tags selecionadas
    const contactTagIds = contact.tags.map(tag => {
      const foundTag = tags.find(t => t.name === tag.name);
      return foundTag?.id;
    }).filter(Boolean);
    
    const matchesTag = selectedTagIds.some(selectedId => contactTagIds.includes(selectedId));
    
    return matchesSearch && matchesTag;
  });
  const handleDeleteContact = async (contact: Contact, muteToast?: boolean) => {
    try {
      // Delete in the correct order due to foreign key constraints

      // 1. Delete messages first
      const {
        error: messagesError
      } = await supabase.from('messages').delete().in('conversation_id', await supabase.from('conversations').select('id').eq('contact_id', contact.id).then(({
        data
      }) => data?.map(c => c.id) || []));
      if (messagesError) throw messagesError;

      // 2. Delete conversation tags
      const {
        error: conversationTagsError
      } = await supabase.from('conversation_tags').delete().in('conversation_id', await supabase.from('conversations').select('id').eq('contact_id', contact.id).then(({
        data
      }) => data?.map(c => c.id) || []));
      if (conversationTagsError) throw conversationTagsError;

      // 3. Delete conversation participants
      const {
        error: participantsError
      } = await supabase.from('conversation_participants').delete().in('conversation_id', await supabase.from('conversations').select('id').eq('contact_id', contact.id).then(({
        data
      }) => data?.map(c => c.id) || []));
      if (participantsError) throw participantsError;

      // 4. Delete conversations
      const {
        error: conversationsError
      } = await supabase.from('conversations').delete().eq('contact_id', contact.id);
      if (conversationsError) throw conversationsError;

      // 5. Delete activities
      const {
        error: activitiesError
      } = await supabase.from('activities').delete().eq('contact_id', contact.id);
      if (activitiesError) throw activitiesError;

      // 6. Delete contact tags
      const {
        error: contactTagsError
      } = await supabase.from('contact_tags').delete().eq('contact_id', contact.id);
      if (contactTagsError) throw contactTagsError;

      // 7. Finally delete the contact
      const {
        error: contactError
      } = await supabase.from('contacts').delete().eq('id', contact.id);
      if (contactError) throw contactError;

      // Update local state
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      if (!muteToast) {
        toast({
          title: "Contato excluído",
          description: "O contato e todos os dados relacionados foram removidos com sucesso."
        });
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      if (!muteToast) {
        toast({
          title: "Erro ao excluir",
          description: "Ocorreu um erro ao excluir o contato. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };
  const handleBulkDelete = async () => {
    const contactsToDelete = contacts.filter(c => selectedIds.includes(c.id));
    try {
      for (const contact of contactsToDelete) {
        await handleDeleteContact(contact, true);
      }
      toast({
        title: "Contatos excluídos",
        description: `${contactsToDelete.length} contatos foram removidos com sucesso.`
      });
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    } catch (error) {
      toast({
        title: "Erro na exclusão em massa",
        description: "Ocorreu um erro ao excluir os contatos. Tente novamente.",
        variant: "destructive"
      });
    }
  };
  const handleAddContact = () => {
    setIsCreateMode(true);
    setEditingContact({
      id: "",
      name: "",
      phone: "",
      email: "",
      createdAt: "",
      tags: [],
      extra_info: {}
    });
    // Start with empty fields
    setCustomFields([]);
    setNewFieldName('');
    setNewFieldValue('');
  };
  const handleEditContact = async (contact: Contact) => {
    setEditingContact(contact);

    // Load existing custom fields from contact_extra_info table
    try {
      const { data: extraInfoData, error } = await supabase
        .from('contact_extra_info')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (extraInfoData && extraInfoData.length > 0) {
        // Map database fields to form fields
        const existingFields = extraInfoData.map(field => ({
          name: field.field_name,
          value: field.field_value
        }));
        setCustomFields(existingFields);
      } else {
        // No existing fields
        setCustomFields([]);
      }
    } catch (error) {
      console.error('Error loading extra info:', error);
      setCustomFields([]);
    }
    
    // Reset new field inputs
    setNewFieldName('');
    setNewFieldValue('');
  };
  const handleSaveContact = async () => {
    if (!editingContact) return;

    // Basic validation
    if (!editingContact.name.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome é obrigatório.",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    try {
      if (isCreateMode) {
        // Create new contact
        const {
          data: newContactData,
          error
        } = await supabase.from('contacts').insert({
          name: editingContact.name.trim(),
          phone: editingContact.phone.trim() || null,
          email: editingContact.email.trim() || null,
          workspace_id: selectedWorkspace!.workspace_id
        }).select().single();
        if (error) throw error;

        // Save custom fields to contact_extra_info table
        const fieldsToInsert = customFields
          .filter(field => field.name.trim() && field.value.trim())
          .map(field => ({
            contact_id: newContactData.id,
            workspace_id: selectedWorkspace!.workspace_id,
            field_name: field.name.trim(),
            field_value: field.value.trim()
          }));

        if (fieldsToInsert.length > 0) {
          const { error: extraInfoError } = await supabase
            .from('contact_extra_info')
            .insert(fieldsToInsert);
          
          if (extraInfoError) {
            console.error('Error saving extra info:', extraInfoError);
          }
        }

        // Add to local state
        const newContact: Contact = {
          id: newContactData.id,
          name: newContactData.name,
          phone: newContactData.phone || '',
          email: newContactData.email || '',
          createdAt: format(new Date(newContactData.created_at), 'dd/MM/yyyy HH:mm:ss'),
          tags: [],
          profile_image_url: newContactData.profile_image_url,
          extra_info: {}
        };
        setContacts(prev => [newContact, ...prev]);
        toast({
          title: "Contato criado",
          description: "O novo contato foi adicionado com sucesso."
        });
      } else {
        // Update existing contact
        const {
          error
        } = await supabase.from('contacts').update({
          name: editingContact.name.trim(),
          phone: editingContact.phone.trim() || null,
          email: editingContact.email.trim() || null,
          updated_at: new Date().toISOString()
        }).eq('id', editingContact.id);
        if (error) throw error;

        // Delete existing extra info fields
        await supabase
          .from('contact_extra_info')
          .delete()
          .eq('contact_id', editingContact.id);

        // Insert new extra info fields
        const fieldsToInsert = customFields
          .filter(field => field.name.trim() && field.value.trim())
          .map(field => ({
            contact_id: editingContact.id,
            workspace_id: selectedWorkspace!.workspace_id,
            field_name: field.name.trim(),
            field_value: field.value.trim()
          }));

        if (fieldsToInsert.length > 0) {
          const { error: extraInfoError } = await supabase
            .from('contact_extra_info')
            .insert(fieldsToInsert);
          
          if (extraInfoError) {
            console.error('Error saving extra info:', extraInfoError);
          }
        }

        // Update local contacts list
        setContacts(prev => prev.map(contact => contact.id === editingContact.id ? {
          ...contact,
          name: editingContact.name.trim(),
          phone: editingContact.phone.trim(),
          email: editingContact.email.trim()
        } : contact));
        toast({
          title: "Contato atualizado",
          description: "As informações do contato foram salvas com sucesso."
        });
      }
      setEditingContact(null);
      setCustomFields([]);
      setIsCreateMode(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as alterações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  const handlePinField = () => {
    if (!newFieldName.trim()) return;
    setPinnedFields(prev => [...prev, newFieldName.trim()]);
    setNewFieldName('');
    setNewFieldValue('');
    toast({
      title: "Campo fixado",
      description: "Agora você pode preencher o valor quando precisar"
    });
  };

  const removePinnedField = (index: number) => {
    setPinnedFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewField = () => {
    if (!newFieldName.trim() || !newFieldValue.trim()) return;
    
    setCustomFields(prev => [...prev, {
      name: newFieldName.trim(),
      value: newFieldValue.trim()
    }]);
    
    // Clear inputs
    setNewFieldName('');
    setNewFieldValue('');
  };
  
  const updateCustomField = (index: number, field: 'name' | 'value', value: string) => {
    setCustomFields(prev => prev.map((item, i) => i === index ? {
      ...item,
      [field]: value
    } : item));
  };
  const removeCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTagToContact = () => {
    // Refetch contacts to show updated tags
    fetchContacts();
    setIsTagModalOpen(false);
    setSelectedContactForTag(null);
  };
  return <div className="p-6 bg-white rounded-lg shadow-lg border border-border/20 m-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center mb-6">
        <h3 className="text-lg font-bold whitespace-nowrap mr-4">
          Contatos ({isLoading ? '...' : filteredContacts.length})
        </h3>
        
        {/* Search and Filter inputs close to title */}
        <div className="flex items-center gap-2 mr-8">
          <div className="relative w-40">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
            <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 text-xs h-8" />
          </div>
          
          <div className="w-40">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-xs h-8"
                >
                  {selectedTagIds.length === 0 ? (
                    <span className="text-muted-foreground">Filtrar por Tags</span>
                  ) : (
                    <span>{selectedTagIds.length} tag(s)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="max-h-60 overflow-y-auto p-2">
                  {tags.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-xs">
                      Nenhuma tag encontrada
                    </div>
                  ) : (
                    <>
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => {
                            setSelectedTagIds(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                        >
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={() => {
                              setSelectedTagIds(prev =>
                                prev.includes(tag.id)
                                  ? prev.filter(id => id !== tag.id)
                                  : [...prev, tag.id]
                              );
                            }}
                          />
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-xs">{tag.name}</span>
                          </div>
                        </div>
                      ))}
                      {selectedTagIds.length > 0 && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => setSelectedTagIds([])}
                          >
                            Limpar filtros
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        {/* Other controls */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center space-x-1 whitespace-nowrap">
            <Checkbox id="duplicates" checked={showDuplicates} onCheckedChange={checked => setShowDuplicates(checked === true)} className="h-3 w-3" />
            <Label htmlFor="duplicates" className="text-xs">Mostrar duplicatas</Label>
          </div>
          
          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black whitespace-nowrap text-xs h-8 px-2" onClick={handleAddContact}>
            Adicionar
          </Button>
          
          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black whitespace-nowrap text-xs h-8 px-2">
            Importar
          </Button>
          
          <Button variant="destructive" size="sm" className="whitespace-nowrap text-xs h-8 px-2" disabled={selectedIds.length === 0} onClick={() => setIsBulkDeleteOpen(true)}>
            Excluir
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table style={{
        fontSize: '10px'
      }}>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Número</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">Criado em</TableHead>
              <TableHead className="text-center">Ações</TableHead>
              <TableHead className="w-12 text-center">
                <Checkbox checked={filteredContacts.length > 0 && filteredContacts.every(contact => selectedIds.includes(contact.id))} onCheckedChange={checked => {
                if (checked) {
                  setSelectedIds(filteredContacts.map(contact => contact.id));
                } else {
                  setSelectedIds([]);
                }
              }} className="h-4 w-4" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Carregando contatos...
                </TableCell>
              </TableRow> : filteredContacts.length === 0 ? <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow> : filteredContacts.map(contact => <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {contact.profile_image_url ? <AvatarImage src={contact.profile_image_url} alt={contact.name} /> : <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>}
                      </Avatar>
                      <span className="font-medium">{contact.name}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-11">
                      <ContactTags 
                        contactId={contact.id} 
                        onTagRemoved={fetchContacts}
                      />
                      <Popover>
                        <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 text-primary"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-64 p-0" 
                          align="start"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ContactTagSelector contactId={contact.id} onTagAdded={fetchContacts} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">{contact.phone}</TableCell>
                <TableCell className="text-center">{contact.email}</TableCell>
                <TableCell className="text-center">{contact.createdAt}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedContactForWhatsApp(contact);
                        setIsWhatsAppModalOpen(true);
                      }}
                      title="Iniciar conversa no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditContact(contact)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletingContact(contact)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={checked => {
                if (checked) {
                  setSelectedIds(prev => [...prev, contact.id]);
                } else {
                  setSelectedIds(prev => prev.filter(id => id !== contact.id));
                }
              }} />
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </div>

      {/* Edit Contact Modal */}
      <Dialog open={!!editingContact} onOpenChange={() => {
      setEditingContact(null);
      setIsCreateMode(false);
    }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? "Adicionar contato" : "Editar contato"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-yellow-600">Nome</Label>
              <Input id="name" value={editingContact?.name || ""} onChange={e => setEditingContact(prev => prev ? {
              ...prev,
              name: e.target.value
            } : null)} className="border-yellow-400" />
            </div>
            
            <div>
              <Label>Telefone</Label>
              <div className="flex gap-2">
                <Select defaultValue="BR">
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BR">BR +55</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={editingContact?.phone || ""} onChange={e => setEditingContact(prev => prev ? {
                ...prev,
                phone: e.target.value
              } : null)} placeholder="(55) 2 1981-5490" />
              </div>
            </div>
            
            <div>
              <Label>Email</Label>
              <Input value={editingContact?.email || ""} onChange={e => setEditingContact(prev => prev ? {
              ...prev,
              email: e.target.value
            } : null)} />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Informações adicionais</Label>
              <div className="space-y-3 mt-2">
                
                {/* Lista de campos fixados (só nome, sem valor) */}
                {pinnedFields.map((fieldName, index) => (
                  <div key={`pinned-${index}`} className="flex gap-2 items-center">
                    <Pin className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    <Input 
                      value={fieldName} 
                      readOnly
                      className="flex-1 font-medium bg-muted"
                      placeholder="Nome do campo"
                    />
                    <Input 
                      placeholder="Preencher depois..." 
                      className="flex-1 text-muted-foreground"
                      disabled
                    />
                    <Button variant="ghost" size="icon" onClick={() => removePinnedField(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {/* Lista de campos completos (nome + valor) */}
                {customFields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Pin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input 
                      value={field.name} 
                      onChange={e => updateCustomField(index, 'name', e.target.value)} 
                      className="flex-1"
                      placeholder="Nome do campo"
                    />
                    <Input 
                      value={field.value} 
                      onChange={e => updateCustomField(index, 'value', e.target.value)} 
                      className="flex-1"
                      placeholder="Valor"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeCustomField(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {/* Inputs para adicionar novo campo */}
                <div className="flex gap-2 items-center">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handlePinField}
                    disabled={!newFieldName.trim()}
                    className="text-yellow-500 hover:text-yellow-600"
                    title="Fixar apenas o nome do campo"
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Input 
                    placeholder="Nome do campo" 
                    value={newFieldName}
                    onChange={e => setNewFieldName(e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    placeholder="Valor" 
                    value={newFieldValue}
                    onChange={e => setNewFieldValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleAddNewField}
                    disabled={!newFieldName.trim() || !newFieldValue.trim()}
                    className="text-green-600 hover:text-green-700"
                    title="Adicionar campo completo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setEditingContact(null);
            setIsCreateMode(false);
          }} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveContact} className="bg-yellow-500 hover:bg-yellow-600 text-black" disabled={isSaving || !editingContact?.name?.trim()}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeletarTicketModal isOpen={!!deletingContact} onClose={() => setDeletingContact(null)} onConfirm={() => {
      if (deletingContact) {
        handleDeleteContact(deletingContact);
        setDeletingContact(null);
      }
    }} />

      {/* Bulk Delete Confirmation Modal */}
      <DeletarTicketModal isOpen={isBulkDeleteOpen} onClose={() => setIsBulkDeleteOpen(false)} onConfirm={handleBulkDelete} />

      {/* WhatsApp Conversation Modal */}
      {selectedContactForWhatsApp && (
        <IniciarConversaContatoModal
          open={isWhatsAppModalOpen}
          onOpenChange={setIsWhatsAppModalOpen}
          contactId={selectedContactForWhatsApp.id}
          contactName={selectedContactForWhatsApp.name}
          contactPhone={selectedContactForWhatsApp.phone}
        />
      )}

      {/* Debug Profile Image Modal */}
      {showDebugModal && debugContact && selectedWorkspace && <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Debug - Imagem de Perfil</DialogTitle>
            </DialogHeader>
            <ProfileImageDebug contactId={debugContact.id} contactName={debugContact.name} contactPhone={debugContact.phone || ''} workspaceId={selectedWorkspace.workspace_id} currentImageUrl={debugContact.profile_image_url || undefined} />
          </DialogContent>
        </Dialog>}

    </div>;
}