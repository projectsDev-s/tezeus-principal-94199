import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Phone,
  MessageCircle,
  Edit,
  Trash2,
  User,
  X,
  Mail,
  MapPin,
  Home,
  Globe,
  FileText,
  Pin,
  Download,
  Upload,
  Filter,
} from "lucide-react";
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
import { useWorkspaceContactFields } from "@/hooks/useWorkspaceContactFields";
import { ConfigurarCamposObrigatoriosModal } from "@/components/modals/ConfigurarCamposObrigatoriosModal";
import { Separator } from "@/components/ui/separator";
interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  created_at?: string; // Campo original para exportação
  tags: Array<{
    name: string;
    color: string;
  }>;
  avatar?: string;
  profile_image_url?: string;
  extra_info?: Record<string, any>;
}
export function CRMContatos() {
  const { selectedWorkspace } = useWorkspace();
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customFields, setCustomFields] = useState<
    Array<{
      key: string;
      value: string;
    }>
  >([]);
  const [newCustomField, setNewCustomField] = useState({
    key: "",
    value: "",
  });
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingFieldType, setEditingFieldType] = useState<"key" | "value" | null>(null);
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
  const [isFieldConfigModalOpen, setIsFieldConfigModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);
  const { tags } = useTags();
  const { toast } = useToast();

  // Hook para campos obrigatórios do workspace
  const { fields: workspaceFields, refetch: refetchWorkspaceFields } = useWorkspaceContactFields(
    selectedWorkspace?.workspace_id || null,
  );

  const buildExtraInfoObject = useCallback((fields: Array<{ key: string; value: string }>) => {
    const result: Record<string, string> = {};

    fields.forEach((field) => {
      const key = field.key?.trim();
      if (!key) return;
      result[key] = field.value?.trim() ?? "";
    });

    return result;
  }, []);

  // Fetch contacts directly from contacts table
  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!selectedWorkspace?.workspace_id) {
        console.warn("⚠️ [CRMContatos] No workspace selected");
        setContacts([]);
        setIsLoading(false);
        return;
      }

      console.log("🔄 [CRMContatos] Fetching contacts for workspace:", selectedWorkspace.workspace_id);

      // ✅ Verificar workspace_id antes de fazer query
      if (!selectedWorkspace.workspace_id) {
        console.error("❌ [CRMContatos] workspace_id is missing!");
        toast({
          title: "Erro",
          description: "Workspace não selecionado. Selecione um workspace primeiro.",
          variant: "destructive",
        });
        setContacts([]);
        setIsLoading(false);
        return;
      }

      console.log("🔍 [CRMContatos] Query params:", {
        workspace_id: selectedWorkspace.workspace_id,
        table: "contacts"
      });

      // Get all contacts from the workspace
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .order("created_at", {
          ascending: false,
        });

      // ✅ Log detalhado do resultado
      console.log("📊 [CRMContatos] Query result:", {
        hasError: !!contactsError,
        errorCode: contactsError?.code,
        errorMessage: contactsError?.message,
        dataLength: contactsData?.length || 0,
        dataPreview: contactsData?.slice(0, 2) // Primeiros 2 contatos para debug
      });

      if (contactsError) {
        console.error("❌ [CRMContatos] Error fetching contacts:", {
          code: contactsError.code,
          message: contactsError.message,
          details: contactsError.details,
          hint: contactsError.hint
        });
        
        // ✅ Verificar se é erro de RLS
        if (contactsError.code === '42501' || contactsError.message?.includes('permission denied') || contactsError.message?.includes('row-level security')) {
          toast({
            title: "Erro de permissão",
            description: "Você não tem permissão para visualizar contatos deste workspace. Verifique suas permissões.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao carregar contatos",
            description: contactsError.message || "Não foi possível carregar os contatos. Tente novamente.",
            variant: "destructive",
          });
        }
        
        setContacts([]);
        setIsLoading(false);
        return;
      }

      if (!contactsData || contactsData.length === 0) {
        console.log("ℹ️ [CRMContatos] No contacts found for workspace:", selectedWorkspace.workspace_id);
        setContacts([]);
        setIsLoading(false);
        return;
      }

      console.log(`✅ [CRMContatos] Found ${contactsData.length} contacts for workspace ${selectedWorkspace.workspace_id}`);

      const contactIds = contactsData.map((c) => c.id);

      // Get contact tags - only if we have contacts
      let contactTagsData: any[] = [];
      let contactExtraInfoData: any[] = [];
      if (contactIds.length > 0) {
        const { data: tagsData, error: tagsError } = await supabase
          .from("contact_tags")
          .select(
            `
            contact_id,
            tags:tag_id (
              id,
              name,
              color
            )
          `,
          )
          .in("contact_id", contactIds);

        if (tagsError) {
          console.warn("⚠️ [CRMContatos] Error fetching tags (non-critical):", tagsError);
          // Continue without tags instead of failing completely
        } else {
          contactTagsData = tagsData || [];
        }

        const { data: extraInfoData, error: extraInfoError } = await supabase
          .from("contact_extra_info")
          .select("contact_id, field_name, field_value")
          .in("contact_id", contactIds);

        if (extraInfoError) {
          console.warn("⚠️ [CRMContatos] Error fetching extra info (non-critical):", extraInfoError);
        } else {
          contactExtraInfoData = extraInfoData || [];
        }
      }

      // Map tags to contacts
      const contactsWithTags = contactsData.map((contact) => {
        const mergedExtraInfo: Record<string, any> = {
          ...((contact.extra_info as Record<string, any>) || {}),
        };

        if (contactExtraInfoData.length > 0) {
          contactExtraInfoData
            .filter((extra) => extra.contact_id === contact.id)
            .forEach((extra) => {
              const key = extra.field_name;
              if (!key) return;
              mergedExtraInfo[key] = extra.field_value ?? "";
            });
        }

        const contactTags =
          contactTagsData
            .filter((ct) => ct.contact_id === contact.id)
            .map((ct) => ({
              name: ct.tags?.name || "",
              color: ct.tags?.color || "#808080",
            })) || [];
        
        return {
          id: contact.id,
          name: contact.name,
          phone: contact.phone || "",
          email: contact.email || "",
          createdAt: format(new Date(contact.created_at), "dd/MM/yyyy HH:mm:ss"),
          created_at: contact.created_at, // Manter o original para exportação
          tags: contactTags,
          profile_image_url: contact.profile_image_url,
          extra_info: mergedExtraInfo,
        };
      });

      console.log(`✅ [CRMContatos] Successfully loaded ${contactsWithTags.length} contacts`);
      setContacts(contactsWithTags);
    } catch (error: any) {
      console.error("❌ [CRMContatos] Unexpected error fetching contacts:", error);
      toast({
        title: "Erro ao carregar contatos",
        description: error?.message || "Ocorreu um erro inesperado. Tente recarregar a página.",
        variant: "destructive",
      });
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWorkspace?.workspace_id, toast]);

  // ✅ CARREGAR CONTATOS AUTOMATICAMENTE quando workspace mudar
  useEffect(() => {
    console.log("🎯 [CRMContatos] useEffect triggered - workspace:", selectedWorkspace?.workspace_id);
    
    if (!selectedWorkspace?.workspace_id) {
      console.warn("⚠️ [CRMContatos] No workspace selected, clearing contacts");
      setContacts([]);
      setIsLoading(false);
      return;
    }

    // ✅ FETCH DIRETO SEM DEPENDÊNCIA CIRCULAR
    const loadContacts = async () => {
      try {
        setIsLoading(true);
        
        console.log("🔄 [CRMContatos] Fetching contacts for workspace:", selectedWorkspace.workspace_id);

      // Get all contacts from the workspace - QUERY SIMPLES
        console.log("🔍 [CRMContatos] Fazendo query com workspace_id:", selectedWorkspace.workspace_id);
        
        const { data: contactsData, error: contactsError } = await supabase
          .from("contacts")
          .select("*")
          .eq("workspace_id", selectedWorkspace.workspace_id)
          .order("created_at", {
            ascending: false,
          });

        console.log("📦 [CRMContatos] Resposta da query:", {
          success: !contactsError,
          count: contactsData?.length || 0,
          error: contactsError,
          sampleData: contactsData?.slice(0, 2)
        });

        if (contactsError) {
          console.error("❌ [CRMContatos] Error:", contactsError);
          toast({
            title: "Erro ao carregar contatos",
            description: contactsError.message || "Não foi possível carregar os contatos.",
            variant: "destructive",
          });
          setContacts([]);
          return;
        }

        if (!contactsData || contactsData.length === 0) {
          console.log("ℹ️ [CRMContatos] No contacts found");
          setContacts([]);
          return;
        }

        console.log(`✅ [CRMContatos] Loaded ${contactsData.length} contacts`);

        // Buscar tags opcionalmente (não bloquear se falhar)
        const contactIds = contactsData.map((c) => c.id);
        let contactTagsData: any[] = [];
        let contactExtraInfoData: any[] = [];
        
        if (contactIds.length > 0) {
          try {
            const { data: tagsData } = await supabase
              .from("contact_tags")
              .select("contact_id, tags:tag_id (id, name, color)")
              .in("contact_id", contactIds);
            
            contactTagsData = tagsData || [];
          } catch (tagsError) {
            console.warn("⚠️ [CRMContatos] Tags error (non-critical):", tagsError);
          }

          try {
            const { data: extraInfoData } = await supabase
              .from("contact_extra_info")
              .select("contact_id, field_name, field_value")
              .in("contact_id", contactIds);

            contactExtraInfoData = extraInfoData || [];
          } catch (extraError) {
            console.warn("⚠️ [CRMContatos] Extra info error (non-critical):", extraError);
          }
        }

        // Mapear contatos com tags
        const contactsWithTags = contactsData.map((contact) => {
          const mergedExtraInfo: Record<string, any> = {
            ...((contact.extra_info as Record<string, any>) || {}),
          };

          if (contactExtraInfoData.length > 0) {
            contactExtraInfoData
              .filter((extra) => extra.contact_id === contact.id)
              .forEach((extra) => {
                const key = extra.field_name;
                if (!key) return;
                mergedExtraInfo[key] = extra.field_value ?? "";
              });
          }

          const contactTags =
            contactTagsData
              .filter((ct) => ct.contact_id === contact.id)
              .map((ct) => ({
                name: ct.tags?.name || "",
                color: ct.tags?.color || "#808080",
              })) || [];
          
          return {
            id: contact.id,
            name: contact.name,
            phone: contact.phone || "",
            email: contact.email || "",
            createdAt: format(new Date(contact.created_at), "dd/MM/yyyy HH:mm:ss"),
            created_at: contact.created_at, // Manter o original para exportação
            tags: contactTags,
            profile_image_url: contact.profile_image_url,
            extra_info: mergedExtraInfo,
          };
        });

        setContacts(contactsWithTags);
      } catch (error: any) {
        console.error("❌ [CRMContatos] Unexpected error:", error);
        toast({
          title: "Erro ao carregar contatos",
          description: error?.message || "Ocorreu um erro inesperado.",
          variant: "destructive",
        });
        setContacts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadContacts();
  }, [selectedWorkspace?.workspace_id, toast]); // ✅ workspace_id e toast como dependências

  // Real-time subscription for contacts changes
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) return;

    console.log("📡 [CRMContatos] Setting up realtime subscription for workspace:", selectedWorkspace.workspace_id);

    const channel = supabase
      .channel(`contacts-changes-${selectedWorkspace.workspace_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        async (payload) => {
          console.log("🆕 [CRMContatos] New contact inserted:", payload.new.id);
          const newContactData = payload.new;
          const newContact: Contact = {
            id: newContactData.id,
            name: newContactData.name,
            phone: newContactData.phone || "",
            email: newContactData.email || "",
            createdAt: format(new Date(newContactData.created_at), "dd/MM/yyyy HH:mm:ss"),
            tags: [],
            profile_image_url: newContactData.profile_image_url,
            extra_info: (newContactData.extra_info as Record<string, any>) || {},
          };
          setContacts((prev) => {
            // Avoid duplicates
            if (prev.some(c => c.id === newContact.id)) {
              return prev;
            }
            return [newContact, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "contacts",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        (payload) => {
          console.log("🔄 [CRMContatos] Contact updated:", payload.new.id);
          // ✅ Atualizar apenas o contato específico (mais eficiente)
          const updatedContact = payload.new;
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === updatedContact.id
                ? {
                    ...contact,
                    name: updatedContact.name,
                    phone: updatedContact.phone || "",
                    email: updatedContact.email || "",
                    profile_image_url: updatedContact.profile_image_url,
                    extra_info: (updatedContact.extra_info as Record<string, any>) || {},
                  }
                : contact
            )
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "contacts",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        (payload) => {
          console.log("🗑️ [CRMContatos] Contact deleted:", payload.old.id);
          const deletedId = payload.old.id;
          setContacts((prev) => prev.filter((c) => c.id !== deletedId));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ [CRMContatos] Realtime subscription active");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ [CRMContatos] Realtime subscription error");
        }
      });

    return () => {
      console.log("🔌 [CRMContatos] Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id, fetchContacts]);

  // Filter contacts based on search and tag filter
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      !searchTerm ||
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm);

    // Se nenhuma tag está selecionada, mostra todos os contatos
    if (selectedTagIds.length === 0) {
      return matchesSearch;
    }

    // Se tags estão selecionadas, o contato deve ter pelo menos uma das tags selecionadas
    const contactTagIds = contact.tags
      .map((tag) => {
        const foundTag = tags.find((t) => t.name === tag.name);
        return foundTag?.id;
      })
      .filter(Boolean);

    const matchesTag = selectedTagIds.some((selectedId) => contactTagIds.includes(selectedId));

    return matchesSearch && matchesTag;
  });
  const handleDeleteContact = async (contact: Contact, muteToast?: boolean): Promise<boolean> => {
    try {
      // Delete in the correct order due to foreign key constraints

      // 1. Delete messages first
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .in(
          "conversation_id",
          await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .then(({ data }) => data?.map((c) => c.id) || []),
        );
      if (messagesError) throw messagesError;

      // 2. Delete conversation tags
      const { error: conversationTagsError } = await supabase
        .from("conversation_tags")
        .delete()
        .in(
          "conversation_id",
          await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .then(({ data }) => data?.map((c) => c.id) || []),
        );
      if (conversationTagsError) throw conversationTagsError;

      // 3. Delete conversation participants
      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .delete()
        .in(
          "conversation_id",
          await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .then(({ data }) => data?.map((c) => c.id) || []),
        );
      if (participantsError) throw participantsError;

      // 4. Delete conversations
      const { error: conversationsError } = await supabase.from("conversations").delete().eq("contact_id", contact.id);
      if (conversationsError) throw conversationsError;

      // 5. Delete n8n chat histories (usando telefone do contato como session_id)
      if (contact.phone) {
        console.log(`🗑️ Deleting n8n_chat_histories for contact phone: ${contact.phone}`);
        
        try {
          // Função para normalizar telefone (remove caracteres não numéricos)
          const normalizePhone = (phone: string): string => {
            return phone.replace(/\D/g, '');
          };

          // Gerar variações possíveis do telefone para buscar
          const phoneVariations = new Set<string>();
          
          // Adicionar formato original
          phoneVariations.add(contact.phone);
          
          // Normalizar e adicionar variações
          const normalized = normalizePhone(contact.phone);
          if (normalized) {
            phoneVariations.add(normalized);
            
            // Variação com código do país (55 para Brasil)
            if (!normalized.startsWith('55') && normalized.length >= 10) {
              phoneVariations.add(`55${normalized}`);
              phoneVariations.add(`+55${normalized}`);
            }
            
            // Variação sem código do país (remove 55 se houver no início)
            if (normalized.startsWith('55') && normalized.length > 2) {
              phoneVariations.add(normalized.substring(2));
            }
            
            // Variação com + no início
            if (!normalized.startsWith('+')) {
              phoneVariations.add(`+${normalized}`);
            }
          }

          const uniqueVariations = Array.from(phoneVariations).filter(p => p && p.trim() !== '');
          console.log(`📋 Trying ${uniqueVariations.length} phone variations:`, uniqueVariations);

          // Tentar deletar com cada variação
          let deletedCount = 0;
          const deletionErrors: string[] = [];

          for (const phoneVar of uniqueVariations) {
            try {
              const { data, error: n8nError } = await supabase
                .from("n8n_chat_histories")
                .delete()
                .eq("session_id", phoneVar)
                .select();
              
              if (n8nError) {
                // Apenas registrar erros críticos (não incluir "No rows" ou "permission denied")
                const errorMsg = n8nError.message || String(n8nError);
                if (!errorMsg.toLowerCase().includes('no rows') && 
                    !errorMsg.toLowerCase().includes('permission') &&
                    !errorMsg.toLowerCase().includes('not found')) {
                  console.warn(`⚠️ Error deleting n8n_chat_histories for ${phoneVar}:`, n8nError);
                  deletionErrors.push(`${phoneVar}: ${errorMsg}`);
                }
              } else {
                const count = data?.length || 0;
                if (count > 0) {
                  deletedCount += count;
                  console.log(`✅ Deleted ${count} record(s) from n8n_chat_histories for ${phoneVar}`);
                }
              }
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              // Apenas registrar erros críticos
              if (!errorMsg.toLowerCase().includes('not found') && 
                  !errorMsg.toLowerCase().includes('permission')) {
                console.warn(`⚠️ Exception deleting n8n_chat_histories for ${phoneVar}:`, errorMsg);
                deletionErrors.push(`${phoneVar}: ${errorMsg}`);
              }
            }
          }

          if (deletedCount > 0) {
            console.log(`✅ Successfully deleted ${deletedCount} record(s) from n8n_chat_histories`);
          } else if (deletionErrors.length > 0) {
            console.warn(`⚠️ Errors occurred during deletion attempts:`, deletionErrors);
          } else {
            console.log(`ℹ️ No records found in n8n_chat_histories for any phone variation`);
          }
        } catch (error) {
          console.error(`❌ Error processing n8n_chat_histories deletion:`, error);
          // Não lançar erro para não impedir a deleção do contato
          // Apenas logar o erro
        }
      }

      // 6. Delete activities
      const { error: activitiesError } = await supabase.from("activities").delete().eq("contact_id", contact.id);
      if (activitiesError) throw activitiesError;

      // 7. Delete contact tags
      const { error: contactTagsError } = await supabase.from("contact_tags").delete().eq("contact_id", contact.id);
      if (contactTagsError) throw contactTagsError;

      // 8. Finally delete the contact
      const { error: contactError } = await supabase.from("contacts").delete().eq("id", contact.id);
      if (contactError) throw contactError;

      // Update local state
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      if (!muteToast) {
        toast({
          title: "Contato excluído",
          description: "O contato e todos os dados relacionados foram removidos com sucesso.",
        });
      }
      return true;
    } catch (error) {
      console.error("Error deleting contact:", error);
      if (!muteToast) {
        toast({
          title: "Erro ao excluir",
          description: "Ocorreu um erro ao excluir o contato. Tente novamente.",
          variant: "destructive",
        });
      }
      // Propagar erro para operações em massa poderem reagir corretamente
      if (muteToast) throw error;
      return false;
    }
  };
  const handleBulkDelete = async () => {
    const contactsToDelete = contacts.filter((c) => selectedIds.includes(c.id));
    try {
      let success = 0;
      for (const contact of contactsToDelete) {
        try {
          const ok = await handleDeleteContact(contact, true);
          if (ok) success++;
        } catch (e) {
          // já tratado por handleDeleteContact quando muteToast=true (rethrow)
        }
      }
      // Recarregar lista da base para garantir consistência visual
      await fetchContacts();
      toast({
        title: "Exclusão em massa finalizada",
        description: `${success} de ${contactsToDelete.length} contatos foram removidos.`,
      });
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    } catch (error) {
      toast({
        title: "Erro na exclusão em massa",
        description: "Ocorreu um erro ao excluir os contatos. Tente novamente.",
        variant: "destructive",
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
      extra_info: {},
    });
    // Start with empty fields
    setCustomFields([]);
    setNewCustomField({ key: "", value: "" });
  };
  const handleEditContact = async (contact: Contact) => {
    setEditingContact(contact);

    const fieldsMap = new Map<string, string>();

    if (contact.extra_info && typeof contact.extra_info === "object") {
      Object.entries(contact.extra_info).forEach(([key, value]) => {
        if (!key) return;
        fieldsMap.set(key, value !== null && value !== undefined ? String(value) : "");
      });
    }

    // Load existing custom fields from contact_extra_info table
    try {
      const { data: extraInfoData, error } = await supabase
        .from("contact_extra_info")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (extraInfoData && extraInfoData.length > 0) {
        extraInfoData.forEach((field) => {
          if (!field.field_name) return;
          fieldsMap.set(field.field_name, field.field_value ?? "");
        });
      }

      if (fieldsMap.size > 0) {
        setCustomFields(
          Array.from(fieldsMap.entries()).map(([key, value]) => ({
            key,
            value,
          })),
        );
      } else {
        setCustomFields([]);
      }
    } catch (error) {
      console.error("Error loading extra info:", error);
      setCustomFields([]);
    }

    // Reset new field inputs
    setNewCustomField({ key: "", value: "" });
  };
  const handleSaveContact = async () => {
    if (!editingContact) return;

    // Basic validation
    if (!editingContact.name.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    // Campos padrões do workspace (não obrigatórios)

    setIsSaving(true);

    // Validar se telefone já existe (apenas no modo criação)
    if (isCreateMode && editingContact.phone.trim()) {
      // Sanitizar telefone para validação (adicionar 55 se não tiver)
      let sanitizedPhone = editingContact.phone.trim();
      if (sanitizedPhone && !sanitizedPhone.startsWith("55")) {
        sanitizedPhone = "55" + sanitizedPhone;
      }

      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("workspace_id", selectedWorkspace!.workspace_id)
        .eq("phone", sanitizedPhone)
        .maybeSingle();

      if (existingContact) {
        toast({
          title: "Telefone já cadastrado",
          description: `Este número já pertence ao contato "${existingContact.name}".`,
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
    }

    try {
      const extraInfoObject = buildExtraInfoObject(customFields);

      if (isCreateMode) {
        // Sanitizar telefone adicionando 55 na frente se não tiver
        let sanitizedPhone = editingContact.phone.trim();
        if (sanitizedPhone && !sanitizedPhone.startsWith("55")) {
          sanitizedPhone = "55" + sanitizedPhone;
        }

        // Create new contact
        const { data: newContactData, error } = await supabase
          .from("contacts")
          .insert({
            name: editingContact.name.trim(),
            phone: sanitizedPhone || null,
            email: editingContact.email.trim() || null,
            workspace_id: selectedWorkspace!.workspace_id,
            extra_info: Object.keys(extraInfoObject).length > 0 ? extraInfoObject : null,
          })
          .select()
          .single();
        if (error) throw error;

        // Save custom fields to contact_extra_info table
        const fieldsToInsert = customFields
          .filter((field) => field.key.trim() && field.value.trim())
          .map((field) => ({
            contact_id: newContactData.id,
            workspace_id: selectedWorkspace!.workspace_id,
            field_name: field.key.trim(),
            field_value: field.value.trim(),
          }));

        if (fieldsToInsert.length > 0) {
          const { error: extraInfoError } = await supabase.from("contact_extra_info").insert(fieldsToInsert);

          if (extraInfoError) {
            console.error("Error saving extra info:", extraInfoError);
          }
        }

        // O contato será adicionado automaticamente pelo realtime subscription
        // Removido a adição manual para evitar duplicação
        toast({
          title: "Contato criado",
          description: "O novo contato foi adicionado com sucesso.",
        });
      } else {
        // Update existing contact
        const { error } = await supabase
          .from("contacts")
          .update({
            name: editingContact.name.trim(),
            email: editingContact.email.trim() || null,
            updated_at: new Date().toISOString(),
            // phone removido - não pode ser alterado para preservar histórico
            extra_info: Object.keys(extraInfoObject).length > 0 ? extraInfoObject : null,
          })
          .eq("id", editingContact.id);
        if (error) throw error;

        // Delete existing extra info fields
        await supabase.from("contact_extra_info").delete().eq("contact_id", editingContact.id);

        // Insert new extra info fields
        const fieldsToInsert = customFields
          .filter((field) => field.key.trim() && field.value.trim())
          .map((field) => ({
            contact_id: editingContact.id,
            workspace_id: selectedWorkspace!.workspace_id,
            field_name: field.key.trim(),
            field_value: field.value.trim(),
          }));

        if (fieldsToInsert.length > 0) {
          const { error: extraInfoError } = await supabase.from("contact_extra_info").insert(fieldsToInsert);

          if (extraInfoError) {
            console.error("Error saving extra info:", extraInfoError);
          }
        }

        // Update local contacts list
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === editingContact.id
              ? {
                  ...contact,
                  name: editingContact.name.trim(),
                  phone: editingContact.phone.trim(),
                  email: editingContact.email.trim(),
                  extra_info: extraInfoObject,
                }
              : contact,
          ),
        );
        toast({
          title: "Contato atualizado",
          description: "As informações do contato foram salvas com sucesso.",
        });
      }
      setEditingContact(null);
      setCustomFields([]);
      setIsCreateMode(false);
    } catch (error: any) {
      console.error("Error saving contact:", error);

      // Verificar se é erro de constraint único
      if (error.code === "23505" && error.message?.includes("idx_contacts_phone_workspace")) {
        toast({
          title: "Telefone duplicado",
          description: "Já existe um contato com este número de telefone neste workspace.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao salvar",
          description: "Ocorreu um erro ao salvar as alterações. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  const handleAddCustomField = () => {
    if (!newCustomField.key.trim() || !newCustomField.value.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome do campo e o valor",
        variant: "destructive",
      });
      return;
    }

    const fieldExists = customFields.some(
      (field) => field.key.toLowerCase() === newCustomField.key.trim().toLowerCase(),
    );
    if (fieldExists) {
      toast({
        title: "Erro",
        description: "Este campo já existe. Use um nome diferente.",
        variant: "destructive",
      });
      return;
    }

    setCustomFields((prev) => [
      ...prev,
      {
        key: newCustomField.key.trim(),
        value: newCustomField.value.trim(),
      },
    ]);

    setNewCustomField({ key: "", value: "" });
  };

  const updateCustomField = (index: number, key: string, value: string) => {
    setCustomFields(
      customFields.map((field, i) =>
        i === index
          ? {
              ...field,
              [key]: value,
            }
          : field,
      ),
    );
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const getFieldIcon = (fieldKey: string) => {
    const key = fieldKey.toLowerCase();
    if (key.includes("email") || key.includes("e-mail")) {
      return <Mail className="h-4 w-4" />;
    }
    if (key.includes("telefone") || key.includes("phone") || key.includes("celular")) {
      return <Phone className="h-4 w-4" />;
    }
    if (key.includes("cep") || key.includes("zip")) {
      return <MapPin className="h-4 w-4" />;
    }
    if (key.includes("endereço") || key.includes("address") || key.includes("rua")) {
      return <Home className="h-4 w-4" />;
    }
    if (key.includes("perfil") || key.includes("tipo") || key.includes("categoria")) {
      return <User className="h-4 w-4" />;
    }
    if (key.includes("país") || key.includes("country") || key.includes("estado")) {
      return <Globe className="h-4 w-4" />;
    }
    if (key.includes("cpf") || key.includes("cnpj") || key.includes("documento")) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const handleAddTagToContact = () => {
    // Refetch contacts to show updated tags
    fetchContacts();
    setIsTagModalOpen(false);
    setSelectedContactForTag(null);
  };

  const handleExportCSV = () => {
    const targetContacts = selectedIds.length > 0
      ? contacts.filter((contact) => selectedIds.includes(contact.id))
      : contacts;

    if (targetContacts.length === 0) {
      toast({
        title: "Nenhum contato para exportar",
        description: selectedIds.length > 0
          ? "Selecione contatos válidos para exportar."
          : "Não há contatos disponíveis para exportação.",
        variant: "destructive",
      });
      return;
    }

    const baseHeaders = ["Nome", "Telefone", "Email", "Data de Criação"];
    const workspaceFieldNames = workspaceFields.map((field) => field.field_name);
    const extraInfoKeySet = new Set<string>();

    targetContacts.forEach((contact) => {
      const extraInfo = contact.extra_info;
      if (extraInfo && typeof extraInfo === "object" && !Array.isArray(extraInfo)) {
        Object.keys(extraInfo).forEach((key) => {
          if (key) {
            extraInfoKeySet.add(key);
          }
        });
      }
    });

    workspaceFieldNames.forEach((key) => {
      if (key) {
        extraInfoKeySet.add(key);
      }
    });

    const orderedWorkspaceKeys = workspaceFieldNames.filter((key) => extraInfoKeySet.has(key));
    const otherExtraKeys = Array.from(extraInfoKeySet).filter((key) => !workspaceFieldNames.includes(key)).sort();
    const extraInfoHeaders = [...orderedWorkspaceKeys, ...otherExtraKeys];
    const headers = [...baseHeaders, ...extraInfoHeaders, "Tags"];

    const normalizeValue = (value: unknown) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }
      return String(value);
    };

    const escapeCSVValue = (value: unknown) => {
      const normalized = normalizeValue(value);
      const escaped = normalized.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [
      headers.map((header) => escapeCSVValue(header)).join(","),
      ...targetContacts.map((contact) => {
        const createdAtFormatted = contact.created_at ? format(new Date(contact.created_at), "dd/MM/yyyy HH:mm") : "";
        const extraInfo = contact.extra_info && typeof contact.extra_info === "object" && !Array.isArray(contact.extra_info)
          ? (contact.extra_info as Record<string, unknown>)
          : {};
        const tagsAsString = (contact.tags || []).map((tag) => tag.name).filter(Boolean).join(", ");

        const rowValues = [
          escapeCSVValue(contact.name),
          escapeCSVValue(contact.phone || ""),
          escapeCSVValue(contact.email || ""),
          escapeCSVValue(createdAtFormatted),
          ...extraInfoHeaders.map((key) => escapeCSVValue(extraInfo[key] ?? "")),
          escapeCSVValue(tagsAsString),
        ];

        return rowValues.join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `contatos_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${targetContacts.length} contato(s) exportado(s) com sucesso.`,
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error("Arquivo CSV vazio ou inválido");
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      const dataLines = lines.slice(1);

      let imported = 0;
      let errors = 0;

      for (const line of dataLines) {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        
        const nameIndex = headers.findIndex((h) => h.toLowerCase().includes("nome"));
        const phoneIndex = headers.findIndex((h) => h.toLowerCase().includes("telefone"));
        const emailIndex = headers.findIndex((h) => h.toLowerCase().includes("email"));

        const name = values[nameIndex] || "";
        const phone = values[phoneIndex] || "";
        const email = values[emailIndex] || "";

        if (!name) {
          errors++;
          continue;
        }

        try {
          const { error } = await supabase.from("contacts").insert({
            name,
            phone,
            email,
            workspace_id: selectedWorkspace.workspace_id,
          });

          if (error) throw error;
          imported++;
        } catch (error) {
          console.error("Erro ao importar contato:", error);
          errors++;
        }
      }

      await fetchContacts();

      toast({
        title: "Importação concluída",
        description: `${imported} contatos importados com sucesso${errors > 0 ? `. ${errors} erros encontrados.` : "."}`,
      });
    } catch (error) {
      console.error("Erro ao processar CSV:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível processar o arquivo CSV.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs">
      {/* Excel-like Toolbar (Ribbonish) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa]">
        {/* Title Bar / Top Menu */}
        <div className="flex items-center justify-between px-4 py-1 bg-primary text-primary-foreground h-8">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="font-semibold text-sm">Contatos</span>
          </div>
          <div className="text-[10px] opacity-80">
            {isLoading ? "Carregando..." : `${filteredContacts.length} registros`}
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* Search Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3" />
              <Input
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-7 px-3 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 flex gap-1">
                   <Filter className="h-3 w-3" />
                  {selectedTagIds.length === 0 ? (
                    <span>Filtro</span>
                  ) : (
                    <span>{selectedTagIds.length}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="max-h-60 overflow-y-auto p-2">
                  {tags.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-xs">Nenhuma tag encontrada</div>
                  ) : (
                    <>
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => {
                            setSelectedTagIds((prev) =>
                              prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                            );
                          }}
                        >
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={() => {
                              setSelectedTagIds((prev) =>
                                prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                              );
                            }}
                          />
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
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

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={() => setIsFieldConfigModalOpen(true)}
            >
              <Pin className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Campos</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={handleAddContact}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Novo</span>
            </Button>

             <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={handleExportCSV}
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Exportar</span>
            </Button>

             <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 text-primary" />
              <span className="text-[9px]">{isImporting ? "..." : "Importar"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-red-50 hover:text-red-600 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              disabled={selectedIds.length === 0}
              onClick={() => setIsBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
              <span className="text-[9px]">Excluir</span>
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
        </div>
      </div>

      {/* Excel Grid Table */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6]">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse bg-white text-xs font-sans">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>Nome</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>Tags</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[120px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Número</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Email</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[140px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Criado em</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-10">
                  <Checkbox
                    checked={
                      filteredContacts.length > 0 && filteredContacts.every((contact) => selectedIds.includes(contact.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(filteredContacts.map((contact) => contact.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="h-3 w-3 rounded-[2px] border-gray-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-[#e0e0e0] px-2 py-1">
                        <div className="h-4 w-32 bg-gray-100 animate-pulse rounded-sm" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1">
                        <div className="h-4 w-32 bg-gray-100 animate-pulse rounded-sm" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center">
                        <div className="h-4 w-24 bg-gray-100 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center">
                        <div className="h-4 w-32 bg-gray-100 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center">
                        <div className="h-4 w-28 bg-gray-100 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center">
                         <div className="h-4 w-16 bg-gray-100 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center"></td>
                    </tr>
                  ))}
                </>
              ) : filteredContacts.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="border border-[#e0e0e0] text-center py-12 bg-gray-50">
                    <div className="flex flex-col items-center gap-2">
                      <User className="h-8 w-8 text-gray-300" />
                      <p className="text-gray-500 font-medium">
                        {searchTerm || selectedTagIds.length > 0
                          ? "Nenhum contato encontrado com os filtros aplicados"
                          : "Nenhum contato cadastrado ainda"}
                      </p>
                      {!searchTerm && selectedTagIds.length === 0 && (
                        <Button
                          size="sm"
                          className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs rounded-sm"
                          onClick={handleAddContact}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar contato
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact, index) => (
                  <tr key={contact.id} className="hover:bg-blue-50 group h-[32px]">
                    {/* Name */}
                    <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap">
                      <div className="flex items-center gap-2 h-full">
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-300">
                           {contact.profile_image_url ? (
                            <img src={contact.profile_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-bold text-gray-500">
                              {contact.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-900 font-medium truncate">{contact.name}</span>
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap align-top">
                      <div className="flex items-start gap-1 h-full">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {contact.tags.length > 0 ? (
                            contact.tags.slice(0, 10).map((tag, i) => (
                              <Badge
                                key={`${contact.id}-tag-${i}`}
                                variant="outline"
                                className="h-5 rounded-none border text-[10px] font-semibold tracking-tight px-2 py-0 flex items-center gap-1"
                                style={{
                                  borderColor: tag.color,
                                  color: tag.color,
                                  backgroundColor: tag.color ? `${tag.color}15` : 'transparent'
                                }}
                              >
                                <span className="truncate max-w-[120px]">{tag.name}</span>
                                <button
                                  className="ml-1 rounded-sm hover:bg-black/10 transition-colors flex items-center justify-center"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await supabase
                                        .from('contact_tags')
                                        .delete()
                                        .eq('contact_id', contact.id)
                                        .eq('tag_id', tag.id);
                                      await fetchContacts();
                                    } catch (error) {
                                      console.error('Erro ao remover tag:', error);
                                    }
                                  }}
                                  title="Remover tag"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Sem tags</span>
                          )}
                        </div>
                        <Popover>
                          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-sm hover:bg-gray-200">
                              <Plus className="h-3 w-3 text-gray-500" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                            <ContactTagSelector contactId={contact.id} onTagAdded={fetchContacts} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-right text-gray-600 whitespace-nowrap font-mono">
                      {contact.phone}
                    </td>

                    {/* Email */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-gray-600 whitespace-nowrap truncate">
                      {contact.email}
                    </td>

                    {/* Created At */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center text-gray-500 whitespace-nowrap">
                      {contact.createdAt}
                    </td>

                    {/* Actions */}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                      <div className="flex items-center justify-center gap-0.5 h-full">
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-sm hover:bg-primary hover:text-primary-foreground text-primary"
                          onClick={() => {
                            setSelectedContactForWhatsApp(contact);
                            setIsWhatsAppModalOpen(true);
                          }}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600"
                          onClick={() => setDeletingContact(contact)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>

                    {/* Checkbox */}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center bg-gray-50">
                      <Checkbox
                        checked={selectedIds.includes(contact.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => [...prev, contact.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== contact.id));
                          }
                        }}
                        className="h-3 w-3 rounded-[2px] border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </td>
                  </tr>
                ))
              )}
              {/* Empty rows to fill space like Excel */}
               {filteredContacts.length > 0 && Array.from({ length: Math.max(0, 20 - filteredContacts.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-[32px]">
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0] bg-gray-50"></td>
                  </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <Dialog
        open={!!editingContact}
        onOpenChange={() => {
          setEditingContact(null);
          setIsCreateMode(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? "Adicionar contato" : "Editar contato"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-primary">
                Nome
              </Label>
              <Input
                id="name"
                value={editingContact?.name || ""}
                onChange={(e) =>
                  setEditingContact((prev) =>
                    prev
                      ? {
                          ...prev,
                          name: e.target.value,
                        }
                      : null,
                  )
                }
                className="border-primary"
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <div className="flex gap-2">
                <Input value="+55" disabled className="w-20" />
                <Input
                  value={editingContact?.phone || ""}
                  onChange={
                    isCreateMode
                      ? (e) =>
                          setEditingContact((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  phone: e.target.value,
                                }
                              : null,
                          )
                      : undefined
                  }
                  readOnly={!isCreateMode}
                  disabled={!isCreateMode}
                  className={!isCreateMode ? "bg-muted cursor-not-allowed" : ""}
                  title={!isCreateMode ? "O telefone não pode ser alterado após a criação do contato" : ""}
                  placeholder={isCreateMode ? "Digite o telefone" : "(55) 2 1981-5490"}
                />
              </div>
              {!isCreateMode && (
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ O número não pode ser alterado para preservar o histórico de conversas
                </p>
              )}
            </div>

            <div>
              <Label>Email</Label>
              <Input
                value={editingContact?.email || ""}
                onChange={(e) =>
                  setEditingContact((prev) =>
                    prev
                      ? {
                          ...prev,
                          email: e.target.value,
                        }
                      : null,
                  )
                }
              />
            </div>

            {/* Campos obrigatórios do workspace */}
            {workspaceFields.length > 0 && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Pin className="h-4 w-4 text-primary" />
                  Campos Padrões
                </Label>
                <div className="space-y-3 mt-2">
                  {workspaceFields.map((field) => {
                    const currentValue = customFields.find((f) => f.key === field.field_name)?.value || "";

                    return (
                      <div
                        key={field.id}
                        className="p-3 bg-warning/10 dark:bg-warning/20 border border-warning/20 dark:border-warning/30 rounded-lg"
                      >
                        <Label className="text-xs font-bold uppercase text-warning dark:text-warning">
                          {field.field_name}
                        </Label>
                        <Input
                          value={currentValue}
                          onChange={(e) => {
                            const exists = customFields.findIndex((f) => f.key === field.field_name);
                            if (exists !== -1) {
                              setCustomFields((prev) =>
                                prev.map((f, i) => (i === exists ? { ...f, value: e.target.value } : f)),
                              );
                            } else {
                              setCustomFields((prev) => [...prev, { key: field.field_name, value: e.target.value }]);
                            }
                          }}
                          placeholder={`Digite ${field.field_name.toLowerCase()}`}
                          className="mt-1 border-primary dark:border-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {workspaceFields.length > 0 && <Separator className="my-4" />}

            <div>
              <Label className="text-sm font-medium">Informações Adicionais (Opcionais)</Label>
              <div className="space-y-3 mt-2">
                {/* Lista de campos opcionais - Cards compactos */}
                <div className="space-y-3">
                  {customFields
                    .filter((field) => !workspaceFields.some((wf) => wf.field_name === field.key))
                    .map((field, index) => {
                      const originalIndex = customFields.findIndex(
                        (f) => f.key === field.key && f.value === field.value,
                      );
                      return (
                        <div
                          key={originalIndex}
                          className="group relative p-4 bg-muted/30 border border-border/40 rounded-lg hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {/* Ícone dinâmico */}
                            <div className="mt-0.5 text-muted-foreground">{getFieldIcon(field.key)}</div>

                            <div className="flex-1 space-y-1 min-w-0">
                              {/* Label do campo - EDITÁVEL com double-click */}
                              {editingFieldIndex === originalIndex && editingFieldType === "key" ? (
                                <input
                                  type="text"
                                  value={field.key}
                                  onChange={(e) => updateCustomField(originalIndex, "key", e.target.value)}
                                  onBlur={() => {
                                    setEditingFieldIndex(null);
                                    setEditingFieldType(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  autoFocus
                                  className="w-full text-xs font-bold uppercase tracking-wide bg-transparent border-none outline-none border-b-2 border-primary pb-0.5"
                                />
                              ) : (
                                <p
                                  className="text-xs font-bold uppercase tracking-wide truncate cursor-pointer"
                                  onDoubleClick={() => {
                                    setEditingFieldIndex(originalIndex);
                                    setEditingFieldType("key");
                                  }}
                                  title="Clique duas vezes para editar"
                                >
                                  {field.key}
                                </p>
                              )}

                              {/* Valor editável com underline inline */}
                              {editingFieldIndex === originalIndex && editingFieldType === "value" ? (
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => updateCustomField(originalIndex, "value", e.target.value)}
                                  onBlur={() => {
                                    setEditingFieldIndex(null);
                                    setEditingFieldType(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  autoFocus
                                  className="w-full text-sm font-normal bg-transparent border-none outline-none border-b-2 border-primary pb-0.5"
                                />
                              ) : (
                                <p
                                  onDoubleClick={() => {
                                    setEditingFieldIndex(originalIndex);
                                    setEditingFieldType("value");
                                  }}
                                  className="text-sm font-normal text-muted-foreground cursor-pointer truncate"
                                  title="Clique duas vezes para editar"
                                >
                                  {field.value || "Clique para adicionar"}
                                </p>
                              )}
                            </div>

                            {/* Botão delete - visível apenas no hover */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              onClick={() => handleRemoveCustomField(originalIndex)}
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Adicionar novo campo */}
                <div className="border-t pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome do campo"
                      value={newCustomField.key}
                      onChange={(e) => setNewCustomField((prev) => ({ ...prev, key: e.target.value }))}
                      className="text-sm h-9"
                    />
                    <Input
                      placeholder="Valor"
                      value={newCustomField.value}
                      onChange={(e) => setNewCustomField((prev) => ({ ...prev, value: e.target.value }))}
                      className="text-sm h-9"
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
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingContact(null);
                setIsCreateMode(false);
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveContact}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSaving || !editingContact?.name?.trim()}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeletarTicketModal
        isOpen={!!deletingContact}
        onClose={() => setDeletingContact(null)}
        onConfirm={() => {
          if (deletingContact) {
            handleDeleteContact(deletingContact);
            setDeletingContact(null);
          }
        }}
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeletarTicketModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />

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
      {showDebugModal && debugContact && selectedWorkspace && (
        <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Debug - Imagem de Perfil</DialogTitle>
            </DialogHeader>
            <ProfileImageDebug
              contactId={debugContact.id}
              contactName={debugContact.name}
              contactPhone={debugContact.phone || ""}
              workspaceId={selectedWorkspace.workspace_id}
              currentImageUrl={debugContact.profile_image_url || undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de configuração de campos obrigatórios */}
      {selectedWorkspace && (
        <ConfigurarCamposObrigatoriosModal
          open={isFieldConfigModalOpen}
          onClose={() => {
            setIsFieldConfigModalOpen(false);
            refetchWorkspaceFields();
          }}
          workspaceId={selectedWorkspace.workspace_id}
        />
      )}
    </div>
  );
}
