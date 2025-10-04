import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, MessageSquare, User, Phone, Plus, Check, X, Clock, Upload, CalendarIcon, Mail, FileText, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTagModal } from "./AddTagModal";
import { AddContactTagButton } from "@/components/chat/AddContactTagButton";
import { CreateActivityModal } from "./CreateActivityModal";
import { TimePickerModal } from "./TimePickerModal";
import { MinutePickerModal } from "./MinutePickerModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { useUsersCache } from "@/hooks/useUsersCache";
import { useContactExtraInfo } from "@/hooks/useContactExtraInfo";
interface Tag {
  id: string;
  name: string;
  color: string;
}
interface Activity {
  id: string;
  type: string;
  subject: string;
  scheduled_for: string;
  responsible_id: string;
  is_completed: boolean;
  users?: {
    name: string;
  };
}
interface DealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealName: string;
  contactNumber: string;
  isDarkMode?: boolean;
  // Dados obrigatórios do card clicado para referência confiável
  cardId: string;
  currentColumnId: string;
  currentPipelineId: string;
  // Dados do contato já disponíveis no card
  contactData?: {
    id: string;
    name: string;
    phone?: string;
    profile_image_url?: string;
  };
}
interface PipelineStep {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  isCompleted: boolean;
}
export function DealDetailsModal({
  isOpen,
  onClose,
  dealName,
  contactNumber,
  isDarkMode = false,
  cardId,
  currentColumnId,
  currentPipelineId,
  contactData: initialContactData
}: DealDetailsModalProps) {
  
  const [activeTab, setActiveTab] = useState("negocios");
  const [contactId, setContactId] = useState<string>("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);
  
  // Estados para o formulário de atividade integrado
  const [activityForm, setActivityForm] = useState({
    type: "Lembrete",
    responsibleId: "",
    subject: "",
    description: "",
    durationMinutes: 30,
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("13:00");
  const [selectedHour, setSelectedHour] = useState<number>(13);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  
  // Hook otimizado para usuários com cache
  const { users, isLoading: isLoadingUsers, loadUsers } = useUsersCache();
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [contactPipelines, setContactPipelines] = useState<any[]>([]);
  const [pipelineCardsCount, setPipelineCardsCount] = useState(0);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(currentPipelineId);
  const [selectedCardId, setSelectedCardId] = useState<string>(cardId);
  const [selectedColumnId, setSelectedColumnId] = useState<string>(currentColumnId);
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [contactData, setContactData] = useState<{
    name: string;
    email: string | null;
    phone: string;
    profile_image_url: string | null;
  } | null>(initialContactData ? {
    name: initialContactData.name,
    email: null,
    phone: initialContactData.phone || contactNumber,
    profile_image_url: initialContactData.profile_image_url || null
  } : null);
  const { toast } = useToast();
  const { selectedPipeline } = usePipelinesContext();
  const { columns, isLoading: isLoadingColumns } = usePipelineColumns(selectedPipelineId);
  
  // Hook para informações adicionais do contato
  const { fields: extraFields, isLoading: isLoadingExtraInfo } = useContactExtraInfo(contactId, workspaceId);
  // A aba "negócio" sempre deve aparecer quando o modal é aberto via card
  const tabs = [{
    id: "negocios",
    label: "Negócios"
  }, {
    id: "atividades",
    label: "Atividades"
  }, {
    id: "historico",
    label: "Histórico"
  }, {
    id: "contato",
    label: "Contato"
  }];
  // Carregar dados quando modal abrir - usando referência confiável do card
  useEffect(() => {
    if (isOpen && cardId) {
      console.log('🚀 Modal aberto com dados do card:', {
        cardId,
        currentColumnId,
        currentPipelineId,
        contactNumber
      });
      fetchCardData();
    }
  }, [isOpen, cardId]);

  // Recarregar atividades quando mudar de negócio
  useEffect(() => {
    if (contactId && selectedCardId) {
      console.log('🔄 Recarregando atividades para o card:', selectedCardId);
      fetchActivities(contactId);
    }
  }, [selectedCardId, contactId]);

  // Converter colunas em steps de progresso
  useEffect(() => {
    if (columns.length > 0 && selectedColumnId) {
      const sortedColumns = [...columns].sort((a, b) => a.order_position - b.order_position);
      const currentIndex = sortedColumns.findIndex(col => col.id === selectedColumnId);
      
      const steps: PipelineStep[] = sortedColumns.map((column, index) => ({
        id: column.id,
        name: column.name,
        color: column.color,
        isActive: index === currentIndex,
        isCompleted: currentIndex >= 0 && index < currentIndex
      }));
      
      setPipelineSteps(steps);
    }
  }, [columns, selectedColumnId]);
  const fetchCardData = async () => {
    setIsLoadingData(true);
    try {
      console.log('🔍 Buscando dados do card:', cardId);
      
      let contactIdToUse: string | null = null;
      
      // Se já temos dados do contato, buscar os dados completos
      if (initialContactData) {
        contactIdToUse = initialContactData.id;
        setContactId(initialContactData.id);
        
        // Buscar dados completos do contato
        const { data: fullContact } = await supabase
          .from('contacts')
          .select('id, name, email, phone, profile_image_url, workspace_id')
          .eq('id', initialContactData.id)
          .single();
        
        if (fullContact) {
          setWorkspaceId(fullContact.workspace_id);
          setContactData({
            name: fullContact.name,
            email: fullContact.email,
            phone: fullContact.phone,
            profile_image_url: fullContact.profile_image_url
          });
          
          // Carregar tags e atividades em paralelo
          await Promise.all([
            fetchContactTags(initialContactData.id),
            fetchActivities(initialContactData.id)
          ]);
        }
      } else {
        // Fallback: buscar todos os dados se não tivermos dados iniciais
        await fetchAdditionalCardData();
        contactIdToUse = contactId;
      }
      
      // SEMPRE buscar os pipelines do contato (independente do fluxo acima)
      if (contactIdToUse) {
        console.log('🔍 Buscando pipelines do contato:', contactIdToUse);
        
        const { data: allCards, error: allCardsError } = await supabase
          .from('pipeline_cards')
          .select(`
            id, 
            pipeline_id, 
            column_id,
            pipelines (
              id, 
              name, 
              type
            )
          `)
          .eq('contact_id', contactIdToUse)
          .eq('status', 'aberto');

        console.log('📊 Cards do contato:', { allCards, allCardsError, count: allCards?.length });

        if (allCards && allCards.length > 0) {
          setAvailableCards(allCards);
          
          // Extrair pipelines únicos
          const uniquePipelines = allCards.reduce((acc: any[], cardItem: any) => {
            const pipeline = cardItem.pipelines;
            if (pipeline && !acc.find(p => p.id === pipeline.id)) {
              acc.push(pipeline);
            }
            return acc;
          }, []);
          
          console.log('🔄 Pipelines únicos encontrados:', uniquePipelines);
          
          setContactPipelines(uniquePipelines);
          setPipelineCardsCount(allCards.length);
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar dados do card:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao carregar dados.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchAdditionalCardData = async () => {
    // Buscar dados do card específico com contato relacionado
    const { data: card, error: cardError } = await supabase
      .from('pipeline_cards')
      .select(`
        id,
        title,
        column_id,
        pipeline_id,
        contact_id,
        contacts (
          id,
          name,
          email,
          phone,
          profile_image_url,
          workspace_id
        ),
        pipelines (
          id,
          name,
          type
        )
      `)
      .eq('id', cardId)
      .maybeSingle();
      
    if (cardError || !card) {
      console.error('❌ Erro ao buscar card:', cardError || 'Card não encontrado');
      toast({
        title: "Erro", 
        description: cardError?.message || "Card não encontrado ou não foi possível carregar os dados.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Card encontrado:', card);
    
    // Definir dados do contato
    const contact = card.contacts;
    if (contact) {
      setContactId(contact.id);
      setWorkspaceId(contact.workspace_id);
      setContactData({
        name: contact.name || 'Nome não informado',
        email: contact.email,
        phone: contact.phone,
        profile_image_url: contact.profile_image_url
      });

      // Buscar todos os cards deste contato para contar
      const { data: allCards, error: allCardsError } = await supabase
        .from('pipeline_cards')
        .select(`
          id, 
          pipeline_id, 
          column_id,
          pipelines (
            id, 
            name, 
            type
          )
        `)
        .eq('contact_id', contact.id)
        .eq('status', 'aberto');

      console.log('📊 Cards do contato:', { allCards, allCardsError, count: allCards?.length });

      if (allCards && allCards.length > 0) {
        setAvailableCards(allCards);
        
        // Extrair pipelines únicos
        const uniquePipelines = allCards.reduce((acc: any[], cardItem: any) => {
          const pipeline = cardItem.pipelines;
          if (pipeline && !acc.find(p => p.id === pipeline.id)) {
            acc.push(pipeline);
          }
          return acc;
        }, []);
        
        console.log('🔄 Pipelines únicos encontrados:', uniquePipelines);
        
        setContactPipelines(uniquePipelines);
        setPipelineCardsCount(allCards.length);
      }

      // Carregar tags e atividades em paralelo
      await Promise.all([
        fetchContactTags(contact.id),
        fetchActivities(contact.id)
      ]);
    }
  };
  const fetchContactTags = async (contactId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('contact_tags').select(`
          id,
          tags (
            id,
            name,
            color
          )
        `).eq('contact_id', contactId);
      if (error) throw error;
      const tags = data?.map(item => item.tags).filter(Boolean) || [];
      setContactTags(tags as Tag[]);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };
  const fetchActivities = async (contactId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('activities').select(`
          id,
          type,
          subject,
          scheduled_for,
          responsible_id,
          is_completed
        `).eq('contact_id', contactId).order('scheduled_for', {
        ascending: true
      });
      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
    }
  };
  const handleTagAdded = (tag: Tag) => {
    setContactTags(prev => [...prev, tag]);
  };
  const handleRemoveTag = async (tagId: string) => {
    try {
      const {
        error
      } = await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tagId);
      if (error) throw error;
      setContactTags(prev => prev.filter(tag => tag.id !== tagId));
      toast({
        title: "Tag removida",
        description: "A tag foi removida do contato."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a tag.",
        variant: "destructive"
      });
    }
  };
  const handleActivityCreated = (activity: Activity) => {
    setActivities(prev => [...prev, activity]);
  };

  // Funções para o formulário de atividade integrado
  const handleDateTimeClick = () => {
    // Este clique não faz nada, o calendário já abre automaticamente pelo Popover
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      // Após selecionar a data, abrir o seletor de hora
      setShowTimePicker(true);
    }
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    setShowTimePicker(false);
    // Após selecionar a hora, abrir o seletor de minutos
    setShowMinutePicker(true);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    setShowMinutePicker(false);
    // Atualizar o selectedTime com a nova hora e minuto
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    setSelectedTime(timeString);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
  };

  const handleCreateActivity = async () => {
    if (!selectedDate || !activityForm.responsibleId || !activityForm.subject.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingActivity(true);
    try {
      // Combinar data e hora
      const [hour, minute] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hour, minute, 0, 0);

      // Get workspace_id from the contact
      const { data: contactDataForActivity } = await supabase
        .from('contacts')
        .select('workspace_id')
        .eq('id', contactId)
        .single();

      if (!contactDataForActivity?.workspace_id) {
        throw new Error('Workspace não encontrado para este contato');
      }

      const activityData = {
        contact_id: contactId,
        workspace_id: contactDataForActivity.workspace_id,
        type: activityForm.type,
        responsible_id: activityForm.responsibleId,
        subject: activityForm.subject,
        description: activityForm.description || null,
        scheduled_for: scheduledDateTime.toISOString(),
        duration_minutes: activityForm.durationMinutes,
        attachment_name: attachedFile?.name || null,
        attachment_url: null,
      };

      const { data: activity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select(`
          id,
          type,
          subject,
          scheduled_for,
          responsible_id,
          is_completed
        `)
        .single();

      if (error) throw error;

      handleActivityCreated(activity);
      
      toast({
        title: "Atividade criada com sucesso!",
        description: `A atividade "${activityForm.subject}" foi agendada.`,
      });

      // Resetar formulário
      setActivityForm({
        type: "Lembrete",
        responsibleId: "",
        subject: "",
        description: "",
        durationMinutes: 30,
      });
      setSelectedDate(new Date());
      setSelectedTime("13:00");
      setAttachedFile(null);
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a atividade.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingActivity(false);
    }
  };

  // Carregar usuários quando necessário usando cache otimizado
  useEffect(() => {
    if (activeTab === "atividades" && users.length === 0) {
      loadUsers();
    }
  }, [activeTab, users.length, loadUsers]);
  const handleCompleteActivity = async (activityId: string) => {
    try {
      const {
        error
      } = await supabase.from('activities').update({
        is_completed: true,
        completed_at: new Date().toISOString()
      }).eq('id', activityId);
      if (error) throw error;
      setActivities(prev => prev.map(activity => activity.id === activityId ? {
        ...activity,
        is_completed: true
      } : activity));
      toast({
        title: "Atividade concluída",
        description: "A atividade foi marcada como concluída."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível concluir a atividade.",
        variant: "destructive"
      });
    }
  };
  const pendingActivities = activities.filter(activity => !activity.is_completed);
  const completedActivities = activities.filter(activity => activity.is_completed);

  // Função para mudar o pipeline/negócio selecionado
  const handlePipelineChange = (newPipelineId: string) => {
    // Encontrar o card deste contato no pipeline selecionado
    const cardInPipeline = availableCards.find(c => c.pipeline_id === newPipelineId);
    
    if (cardInPipeline) {
      setSelectedPipelineId(newPipelineId);
      setSelectedCardId(cardInPipeline.id);
      setSelectedColumnId(cardInPipeline.column_id);
    }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("max-w-6xl w-full h-[90vh] p-0 gap-0", isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white")}>
        {/* Header */}
        <DialogHeader className={cn("px-6 py-4 border-b", isDarkMode ? "border-gray-600" : "border-gray-200")}>
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" onClick={onClose} className={cn("h-8 w-8", isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            <Avatar className="w-12 h-12">
              <AvatarImage 
                src={contactData?.profile_image_url} 
                alt={contactData?.name || "Contato"}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                {contactData?.name ? contactData.name.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex items-start gap-4">
              <div className="flex flex-col">
                <DialogTitle className={cn("text-xl font-semibold text-left", isDarkMode ? "text-white" : "text-gray-900")}>
                  {contactData?.name || dealName}
                </DialogTitle>
                <p className={cn("text-sm text-left", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  {contactData?.phone || contactNumber}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 px-3 py-1 text-xs">
                  Ver Conversas
                </Badge>
                
                {/* Tags do contato */}
                {contactTags.map(tag => <Badge key={tag.id} variant="outline" className={cn("border-gray-300 px-3 py-1 text-xs group relative", isDarkMode ? "text-gray-300 border-gray-600" : "text-gray-600")} style={{
                borderColor: tag.color,
                color: tag.color
              }}>
                    {tag.name}
                    <Button size="icon" variant="ghost" className="ml-1 h-3 w-3 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveTag(tag.id)}>
                      <X className="w-2 h-2" />
                    </Button>
                  </Badge>)}
                
                {/* Botão "mais" para adicionar tags - funcional */}
                {contactId && (
                  <AddContactTagButton 
                    contactId={contactId} 
                    isDarkMode={isDarkMode}
                    onTagAdded={() => {
                      // Recarregar tags do contato após adicionar
                      if (contactId) {
                        fetchContactTags(contactId);
                      }
                    }} 
                  />
                )}
              </div>
            </div>
            
            <div className="flex-1" />
          </div>
        </DialogHeader>


        {/* Tabs */}
        <div className={cn("flex border-b", isDarkMode ? "border-gray-600" : "border-gray-200")}>
          {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("px-6 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === tab.id ? "border-yellow-400 text-yellow-600" : "border-transparent", isDarkMode ? activeTab === tab.id ? "text-yellow-400" : "text-gray-400 hover:text-white" : activeTab === tab.id ? "text-yellow-600" : "text-gray-600 hover:text-gray-900")}>
              {tab.label}
            </button>)}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "negocios" && <div className="space-y-6">
              {/* Pipeline Selection */}
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Negócios do Contato
                </label>
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    {isLoadingData ? 'Carregando...' : `${pipelineCardsCount} ${pipelineCardsCount === 1 ? 'Negócio' : 'Negócios'}`}
                  </span>
                  
                  {contactPipelines.length > 0 && (
                    <Select 
                      value={selectedPipelineId} 
                      onValueChange={handlePipelineChange}
                    >
                      <SelectTrigger className={cn("flex-1", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                        <SelectValue placeholder="Selecione um negócio" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactPipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name} ({pipeline.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Pipeline Timeline - Baseado na imagem de referência */}
              <div className="space-y-6">
                {isLoadingColumns ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-pulse space-y-4 w-full">
                      <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                      <div className="flex justify-between">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex flex-col items-center space-y-2">
                            <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                            <div className="h-3 bg-gray-300 rounded w-16"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : pipelineSteps.length > 0 ? (
                  <div className="w-full space-y-4">
                    {/* Debug: renderização dos steps */}
                    {(() => {
                      console.log('🎨 Renderizando pipeline steps:', {
                        currentColumnId,
                        stepsLength: pipelineSteps.length,
                        steps: pipelineSteps.map(s => ({ 
                          name: s.name, 
                          isActive: s.isActive, 
                          isCompleted: s.isCompleted 
                        }))
                      });
                      return null;
                    })()}
                    
                    {/* Informação da posição atual */}
                    {selectedColumnId && (
                      <div className={cn("mb-4 p-3 rounded-lg border", 
                        isDarkMode 
                          ? "bg-yellow-900/30 border-yellow-700 text-yellow-300" 
                          : "bg-yellow-50 border-yellow-200 text-yellow-800"
                      )}>
                        <p className="text-sm">
                          <strong>Etapa atual:</strong> {pipelineSteps.find(s => s.isActive)?.name || 'Não definida'}
                        </p>
                      </div>
                    )}
                    
                    {/* Pipeline Visual */}
                    <div className="relative pt-6 pb-16">
                      {/* Container das etapas com linha */}
                      <div className="relative flex justify-between items-start">
                        {/* Linha de fundo - contínua */}
                        <div 
                          className={cn("absolute left-0 right-0 h-1 z-0", 
                            isDarkMode ? "bg-gray-600" : "bg-gray-300"
                          )} 
                          style={{ top: '24px' }}
                        ></div>
                        
                        {/* Linha de progresso */}
                        {pipelineSteps.length > 1 && (
                          <div 
                            className="absolute left-0 h-1 bg-yellow-400 z-10 transition-all duration-500"
                            style={{ 
                              top: '24px',
                              width: `${Math.max(0, Math.min(100, ((pipelineSteps.findIndex(step => step.isActive) + 0.5) / Math.max(1, pipelineSteps.length - 1)) * 100))}%`
                            }}
                          ></div>
                        )}
                        
                        {/* Etapas */}
                        {pipelineSteps.map((step, index) => {
                          const currentStepIndex = pipelineSteps.findIndex(s => s.isActive);
                          const isCompleted = currentStepIndex >= 0 && index < currentStepIndex;
                          const isActive = index === currentStepIndex;
                          const isFuture = currentStepIndex >= 0 && index > currentStepIndex;
                          
                          return (
                            <div 
                              key={step.id} 
                              className="flex flex-col items-center justify-start z-20"
                              style={{ flex: '1' }}
                            >
                              {/* Círculo - centralizado na linha */}
                              <div 
                                className={cn(
                                  "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-4 transition-all duration-300",
                                  isCompleted && "bg-green-500 border-green-500 text-white",
                                  isActive && "bg-yellow-400 border-yellow-400 text-black",
                                  isFuture && "bg-white border-gray-300 text-gray-500"
                                )}
                              >
                                {isCompleted ? (
                                  <Check className="w-5 h-5" />
                                ) : (
                                  <span className="font-bold">{index + 1}</span>
                                )}
                              </div>
                              
                              {/* Texto - centralizado abaixo do círculo */}
                              <div className="mt-3 text-center" style={{ maxWidth: '90px' }}>
                                <p 
                                  className={cn(
                                    "text-xs font-medium leading-tight",
                                    isActive && "text-yellow-600 font-bold",
                                    isCompleted && "text-green-600 font-semibold", 
                                    isFuture && "text-gray-500"
                                  )}
                                >
                                  {step.name}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                      Nenhuma coluna encontrada no pipeline
                    </p>
                  </div>
                )}
              </div>

              {/* Cadência de Tarefas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={cn("text-lg font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                    Cadência de tarefas
                  </h3>
                  <Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500">
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                
                <div className={cn("text-center py-8", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  <p>Nenhuma cadência de tarefas encontrada</p>
                </div>
              </div>
            </div>}

          {activeTab === "atividades" && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Histórico de Atividades */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className={cn("text-lg font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                    Histórico de Atividades
                  </h3>
                  
                </div>
                
                {pendingActivities.length > 0 ? <div className="space-y-3">
                    {pendingActivities.map(activity => <div key={activity.id} className={cn("border rounded-lg p-4", isDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-gray-50")}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {activity.type}
                              </Badge>
                              <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                                {activity.users?.name}
                              </span>
                            </div>
                            <h4 className={cn("font-medium", isDarkMode ? "text-white" : "text-gray-900")}>
                              {activity.subject}
                            </h4>
                            <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                              {format(new Date(activity.scheduled_for), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR
                      })}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleCompleteActivity(activity.id)} className="ml-4">
                            <Check className="w-4 h-4 mr-1" />
                            Concluir
                          </Button>
                        </div>
                      </div>)}
                  </div> : <div className={cn("text-center py-8", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                    <p>Nenhuma atividade pendente encontrada</p>
                  </div>}
              </div>

              {/* Formulário Criar Atividade - Integrado */}
              <div className="space-y-4">
                <h3 className={cn("text-lg font-semibold mb-4", isDarkMode ? "text-white" : "text-gray-900")}>
                  Criar atividade
                </h3>
                
                <div className="space-y-4">
                  {/* Tipo */}
                  <div className="space-y-2">
                    <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      Tipo
                    </label>
                    <Select value={activityForm.type} onValueChange={(value) => setActivityForm({...activityForm, type: value})}>
                      <SelectTrigger className={cn("w-full", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const activityTypes = [
                              { value: "Lembrete", label: "Lembrete", icon: Clock },
                              { value: "Mensagem", label: "Mensagem", icon: MessageSquare },
                              { value: "Ligação", label: "Ligação", icon: Phone },
                              { value: "Reunião", label: "Reunião", icon: User },
                              { value: "Agendamento", label: "Agendamento", icon: CalendarIcon },
                            ];
                            const selectedType = activityTypes.find(t => t.value === activityForm.type);
                            const Icon = selectedType?.icon || Clock;
                            return (
                              <>
                                <Icon className="w-4 h-4" />
                                <span>{selectedType?.label || activityForm.type}</span>
                              </>
                            );
                          })()}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: "Lembrete", label: "Lembrete", icon: Clock },
                          { value: "Mensagem", label: "Mensagem", icon: MessageSquare },
                          { value: "Ligação", label: "Ligação", icon: Phone },
                          { value: "Reunião", label: "Reunião", icon: User },
                          { value: "Agendamento", label: "Agendamento", icon: CalendarIcon },
                        ].map((type) => {
                          const Icon = type.icon;
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Responsável */}
                  <div className="space-y-2">
                    <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      Responsável
                    </label>
                    <Select value={activityForm.responsibleId} onValueChange={(value) => setActivityForm({...activityForm, responsibleId: value})}>
                      <SelectTrigger className={cn("w-full", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                        <SelectValue placeholder={isLoadingUsers ? "Carregando usuários..." : "Selecione um responsável"} />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assunto */}
                  <div className="space-y-2">
                    <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      Assunto
                    </label>
                    <Input 
                      placeholder="Digite o assunto da atividade" 
                      value={activityForm.subject}
                      onChange={(e) => setActivityForm({...activityForm, subject: e.target.value})}
                      className={cn(isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
                    />
                  </div>

                  {/* Data e Duração em linha */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Agendar para
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className={cn("w-full justify-start text-left font-normal", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white hover:bg-gray-700" : "bg-white")}
                            onClick={handleDateTimeClick}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate && selectedTime ? 
                              `${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} ${selectedTime}` : 
                              "Selecionar data e hora"
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar 
                            mode="single" 
                            selected={selectedDate} 
                            onSelect={handleDateSelect} 
                            initialFocus 
                            className="pointer-events-auto" 
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Duração (minutos)
                      </label>
                      <Input 
                        type="number" 
                        value={activityForm.durationMinutes} 
                        onChange={(e) => setActivityForm({...activityForm, durationMinutes: Number(e.target.value)})}
                        className={cn(isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
                      />
                    </div>
                  </div>

                  {/* Upload de arquivo */}
                  <div className="space-y-2">
                    <div className={cn("border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors", isDarkMode ? "border-gray-600 hover:border-gray-500 bg-[#1f1f1f]" : "border-gray-300 hover:border-gray-400 bg-gray-50")}>
                      {attachedFile ? (
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                            {attachedFile.name}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={removeFile}
                            className="h-6 w-6 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            onChange={handleFileUpload}
                            className="hidden"
                            accept="*/*"
                          />
                          <Upload className={cn("w-8 h-8 mx-auto mb-2", isDarkMode ? "text-gray-400" : "text-gray-500")} />
                          <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                            Clique aqui ou arraste o documento a ser salvo
                          </p>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-2">
                    <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      Descrição
                    </label>
                    <Textarea 
                      placeholder="Descrição" 
                      rows={4} 
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({...activityForm, description: e.target.value})}
                      className={cn(isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
                    />
                  </div>

                  {/* Botão Criar Atividade */}
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                    onClick={handleCreateActivity} 
                    disabled={!contactId || isCreatingActivity}
                  >
                    {isCreatingActivity ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </div>
            </div>}

          {activeTab === "historico" && <div className="space-y-4">
              <h3 className={cn("text-lg font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                Histórico de Atividades Concluídas
              </h3>
              
              {completedActivities.length > 0 ? <div className="space-y-3">
                  {completedActivities.map(activity => <div key={activity.id} className={cn("border rounded-lg p-4", isDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-gray-50")}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.type}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Concluída
                        </Badge>
                        <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          {activity.users?.name}
                        </span>
                      </div>
                      <h4 className={cn("font-medium", isDarkMode ? "text-white" : "text-gray-900")}>
                        {activity.subject}
                      </h4>
                      <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                        {format(new Date(activity.scheduled_for), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR
                })}
                      </p>
                    </div>)}
                </div> : <div className={cn("text-center py-8", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  <p>Nenhuma atividade concluída encontrada</p>
                </div>}
            </div>}

          {activeTab === "contato" && <div className="space-y-6">
              {/* Informações de Contato */}
              <div className="space-y-4">
                <h3 className={cn("text-lg font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                  Informações de Contato
                </h3>
                
                {contactData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card Email - só exibe se tiver email */}
                    {contactData.email && (
                      <div className={cn(
                        "border rounded-lg p-4 flex items-center gap-3",
                        isDarkMode ? "border-gray-600 bg-gray-800/50" : "border-gray-200 bg-gray-50"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isDarkMode ? "bg-gray-700" : "bg-gray-100"
                        )}>
                          <Mail className={cn("w-5 h-5", isDarkMode ? "text-gray-300" : "text-gray-600")} />
                        </div>
                        <div className="flex-1">
                          <p className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                            Email
                          </p>
                          <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                            {contactData.email}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Card Telefone - só exibe se tiver telefone */}
                    {contactData.phone && (
                      <div className={cn(
                        "border rounded-lg p-4 flex items-center gap-3",
                        isDarkMode ? "border-gray-600 bg-gray-800/50" : "border-gray-200 bg-gray-50"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isDarkMode ? "bg-gray-700" : "bg-gray-100"
                        )}>
                          <Phone className={cn("w-5 h-5", isDarkMode ? "text-gray-300" : "text-gray-600")} />
                        </div>
                        <div className="flex-1">
                          <p className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                            Telefone
                          </p>
                          <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                            {contactData.phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Campos extras - cada campo é exibido individualmente */}
                    {extraFields.map((field, index) => {
                      // Cada campo extra é exibido como um card separado
                      // field_name é o label, field_value é o conteúdo
                      
                      // Só renderiza se tiver nome e valor
                      if (!field.field_name?.trim() || !field.field_value?.trim()) {
                        return null;
                      }
                      
                      return (
                        <div 
                          key={field.id || index}
                          className={cn(
                            "border rounded-lg p-4 flex items-center gap-3",
                            isDarkMode ? "border-gray-600 bg-gray-800/50" : "border-gray-200 bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isDarkMode ? "bg-gray-700" : "bg-gray-100"
                          )}>
                            <FileText className={cn("w-5 h-5", isDarkMode ? "text-gray-300" : "text-gray-600")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                              {field.field_name}
                            </p>
                            <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                              {field.field_value}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <div className={cn("text-center", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                      Carregando informações do contato...
                    </div>
                  </div>
                )}
              </div>
            </div>}
        </div>

        {/* Modais */}
        <AddTagModal isOpen={showAddTagModal} onClose={() => setShowAddTagModal(false)} contactId={contactId} onTagAdded={handleTagAdded} isDarkMode={isDarkMode} />

        <CreateActivityModal isOpen={showCreateActivityModal} onClose={() => setShowCreateActivityModal(false)} contactId={contactId} onActivityCreated={handleActivityCreated} isDarkMode={isDarkMode} />
      </DialogContent>

      {/* Modais de seleção de hora e minuto */}
      <TimePickerModal
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onTimeSelect={handleHourSelect}
        isDarkMode={isDarkMode}
      />
      
      <MinutePickerModal
        isOpen={showMinutePicker}
        onClose={() => setShowMinutePicker(false)}
        onMinuteSelect={handleMinuteSelect}
        isDarkMode={isDarkMode}
      />
    </Dialog>;
}