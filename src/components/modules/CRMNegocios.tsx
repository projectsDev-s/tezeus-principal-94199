import React, { useState, useCallback, useEffect } from "react";
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useParams } from 'react-router-dom';
import { ConnectionBadge } from "@/components/chat/ConnectionBadge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter, DragOverEvent, Active, Over } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Search, Plus, Filter, Eye, MoreHorizontal, Phone, MessageCircle, MessageSquare, Calendar, DollarSign, User, EyeOff, Folder, AlertTriangle, Check, MoreVertical, Edit, Download, ArrowRight, X, Tag, Bot, Zap } from "lucide-react";
import { AddColumnModal } from "@/components/modals/AddColumnModal";
import { PipelineConfigModal } from "@/components/modals/PipelineConfigModal";
import { EditarColunaModal } from "@/components/modals/EditarColunaModal";
import { FilterModal } from "@/components/modals/FilterModal";
import { CriarPipelineModal } from "@/components/modals/CriarPipelineModal";
import { CriarNegocioModal } from "@/components/modals/CriarNegocioModal";
import { DealDetailsModal } from "@/components/modals/DealDetailsModal";
import { ChatModal } from "@/components/modals/ChatModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TransferirModal } from "@/components/modals/TransferirModal";
import { SetValueModal } from "@/components/modals/SetValueModal";
import { EditarContatoModal } from "@/components/modals/EditarContatoModal";
import { VincularProdutoModal } from "@/components/modals/VincularProdutoModal";
import { VincularResponsavelModal } from "@/components/modals/VincularResponsavelModal";
import { DeleteDealModal } from "@/components/modals/DeleteDealModal";
import { usePipelinesContext, PipelinesProvider } from "@/contexts/PipelinesContext";
import { usePipelineActiveUsers } from "@/hooks/usePipelineActiveUsers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { ActiveUsersAvatars } from "@/components/pipeline/ActiveUsersAvatars";
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useContactTags } from "@/hooks/useContactTags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { ChangeAgentModal } from "@/components/modals/ChangeAgentModal";
import { useWorkspaceAgent } from "@/hooks/useWorkspaceAgent";

// Componente de Badge do Agente
function AgentBadge({ conversationId }: { conversationId: string }) {
  const { agent, isLoading } = useWorkspaceAgent(conversationId);
  
  console.log('🤖 [AgentBadge] Renderizando:', { conversationId, hasAgent: !!agent, isLoading });
  
  if (isLoading) return null;
  if (!agent) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
            <Bot className="h-3 w-3" />
            <span className="text-[10px] font-medium">{agent.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Agente IA ativo: {agent.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente Sortable do Card com Drag & Drop e Selection
// Interface compatível com o componente existente
interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  responsible: string;
  responsible_user_id?: string;
  responsible_avatar?: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  product?: string;
  product_name?: string;
  product_id?: string;
  lastContact?: string;
  created_at?: string;
  contact?: {
    id: string;
    name: string;
    phone?: string;
    profile_image_url?: string;
    contact_tags?: Array<{
      tag_id: string;
      tags: {
        id: string;
        name: string;
        color: string;
      };
    }>;
  };
  conversation?: {
    id: string;
    connection_id?: string;
    agente_ativo?: boolean;
    connection?: {
      id: string;
      instance_name: string;
      phone_number?: string;
      status: string;
      metadata?: any;
    };
    queue?: {
      id: string;
      name: string;
      ai_agent?: {
        id: string;
        name: string;
      };
    };
  };
}
interface DroppableColumnProps {
  children: React.ReactNode;
  id: string;
}
function DroppableColumn({
  children,
  id
}: DroppableColumnProps) {
  const {
    isOver,
    setNodeRef
  } = useDroppable({
    id: id
  });
  return <div ref={setNodeRef} className={`h-full ${isOver ? 'bg-blue-50' : ''}`}>
      {children}
    </div>;
}
interface DraggableDealProps {
  deal: Deal;
  isDarkMode?: boolean;
  onClick: () => void;
  columnColor?: string;
  onChatClick?: (deal: Deal) => void;
  onValueClick?: (deal: Deal) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onEditContact?: (contactId: string) => void;
  onLinkProduct?: (cardId: string, currentValue: number) => void;
  onDeleteCard?: (cardId: string) => void;
  onOpenTransferModal?: (cardId: string) => void;
  onVincularResponsavel?: (cardId: string, conversationId?: string, currentResponsibleId?: string, contactId?: string) => void;
  onConfigureAgent?: (conversationId: string) => void;
}
function DraggableDeal({
  deal,
  isDarkMode = false,
  onClick,
  columnColor = '#6b7280',
  onChatClick,
  onValueClick,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onEditContact,
  onLinkProduct,
  onDeleteCard,
  onOpenTransferModal,
  onVincularResponsavel,
  onConfigureAgent
}: DraggableDealProps) {
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    toast
  } = useToast();
  const [isTagPopoverOpen, setIsTagPopoverOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [visibleTagId, setVisibleTagId] = React.useState<string | null>(null);
  const [hideTimeout, setHideTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const {
    contactTags,
    availableTags,
    addTagToContact,
    getFilteredTags,
    refreshTags
  } = useContactTags(deal.contact?.id || null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `card-${deal.id}`
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Gerar iniciais do responsável para o avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
  };

  // Formatar tempo relativo de criação
  const formatTimeAgo = (createdAt?: string) => {
    if (!createdAt) return 'Data indisponível';
    const createdDate = new Date(createdAt);
    const hoursAgo = differenceInHours(new Date(), createdDate);
    if (hoursAgo < 24) {
      return formatDistanceToNow(createdDate, {
        addSuffix: true,
        locale: ptBR
      });
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      return `há ${daysAgo} ${daysAgo === 1 ? 'dia' : 'dias'}`;
    }
  };
  return <Card ref={setNodeRef} style={{
    ...style,
    borderLeftColor: columnColor
  }} {...!isSelectionMode && {
    ...attributes,
    ...listeners
  }} className={cn("hover:shadow-md transition-shadow mb-2 md:mb-2.5 border-l-4 relative min-h-[100px] md:min-h-[110px]", !isSelectionMode && "cursor-pointer", isSelectionMode && "cursor-pointer hover:bg-accent/50", isSelected && isSelectionMode && "ring-2 ring-primary bg-accent/30", isDarkMode ? "bg-card border-border" : "bg-card border-border")} onClick={isSelectionMode ? e => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelection?.();
  } : onClick}>
    <CardContent className="p-2 md:p-2.5">
      {isSelectionMode && <div className="absolute top-2 right-2 z-10">
          <input type="checkbox" checked={isSelected} onChange={e => {
          e.stopPropagation();
          onToggleSelection?.();
        }} onClick={e => e.stopPropagation()} className="w-5 h-5 cursor-pointer accent-primary" />
        </div>}
      {/* Header com menu, avatar, nome e produto/valor */}
      <div className="flex items-center gap-2 mb-2">
          {/* Menu de ações - PRIMEIRO */}
          {!isSelectionMode && <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-foreground flex-shrink-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover z-50" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              onVincularResponsavel?.(deal.id, deal.conversation?.id, deal.responsible_user_id, deal.contact?.id);
            }}>
                  Vincular Responsável
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              onOpenTransferModal?.(deal.id);
            }}>
                  Trocar Negócio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              if (deal.contact?.id) {
                onEditContact?.(deal.contact.id);
              }
            }}>
                  Editar Contato
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              onLinkProduct?.(deal.id, deal.value);
            }}>
                  Vincular Produto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={e => {
              e.stopPropagation();
              onDeleteCard?.(deal.id);
            }} className="text-destructive focus:text-destructive">
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          
          {/* Avatar do contato - SEGUNDO */}
          <div className="flex-shrink-0">
            {deal.contact?.profile_image_url ? <img src={deal.contact.profile_image_url} alt={deal.contact.name || deal.name} className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover border border-primary/20" onError={e => {
            // Fallback para iniciais se a imagem falhar
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }} /> : null}
            <div className={cn("w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-medium", "bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/20", deal.contact?.profile_image_url ? "hidden" : "")}>
              {getInitials(deal.contact?.name || deal.name)}
            </div>
          </div>
          
          {/* Nome + Produto/Valor na MESMA LINHA */}
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
            {/* Nome do cliente à esquerda */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <h3 className={cn("text-xs font-medium truncate", "text-foreground")}>
                {deal.contact?.name || deal.name}
              </h3>
              
              {/* Badge de Agente IA Ativo */}
              {deal.conversation?.agente_ativo && <AgentBadge conversationId={deal.conversation.id} />}
            </div>
            
            {/* Produto + Preço à direita */}
            <div className="flex items-center gap-1 text-xs flex-shrink-0">
              {deal.product_name && <span className="text-muted-foreground truncate max-w-[80px]">
                  {deal.product_name}
                </span>}
              {deal.value ? <span className="text-primary font-medium">
                  R$ {deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span> : <span className="text-xs text-muted-foreground/60 hover:text-primary/70 cursor-pointer transition-colors" onClick={(e) => {
              e.stopPropagation();
              onValueClick?.(deal);
            }}>
                  +preço
                </span>}
            </div>
          </div>
        </div>
        
        {/* Área central para tags do contato */}
        <div className="mb-2 min-h-[24px] flex items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-1 flex-1 min-w-0">
          {contactTags.map(tag => (
            <div
              key={tag.id}
              className="relative cursor-pointer flex items-center"
              onMouseEnter={() => {
                if (hideTimeout) {
                  clearTimeout(hideTimeout);
                  setHideTimeout(null);
                }
                setVisibleTagId(tag.id);
              }}
              onMouseLeave={() => {
                const timeout = setTimeout(() => {
                  setVisibleTagId(null);
                }, 1000);
                setHideTimeout(timeout);
              }}
            >
              <Tag 
                className="w-3 h-3 flex-shrink-0" 
                style={{ color: tag.color }} 
                fill={tag.color}
              />
              <span 
                onMouseEnter={() => {
                  if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    setHideTimeout(null);
                  }
                }}
                onMouseLeave={() => {
                  const timeout = setTimeout(() => {
                    setVisibleTagId(null);
                  }, 1000);
                  setHideTimeout(timeout);
                }}
                className={`absolute left-3 top-1/2 -translate-y-1/2 -translate-x-1 whitespace-nowrap transition-all duration-300 ease-out px-1.5 py-0.5 rounded-full z-[9999] flex items-center gap-0.5 text-xs ${
                  visibleTagId === tag.id ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none"
                }`}
                style={{ 
                  backgroundColor: 'white',
                  borderColor: tag.color,
                  color: tag.color,
                  border: `1px solid ${tag.color}`
                }}
              >
                {tag.name}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await supabase.from('contact_tags').delete().eq('contact_id', deal.contact?.id).eq('tag_id', tag.id);
                      await refreshTags();
                    } catch (error) {
                      console.error('Erro ao remover tag:', error);
                    }
                  }}
                  className="hover:bg-black/10 rounded-full p-0.5 transition-colors flex-shrink-0 pointer-events-auto"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            </div>
          ))}
          <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
            <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="h-5 px-1.5 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 text-primary">
                <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start" onClick={e => e.stopPropagation()}>
              <Command>
                <CommandInput placeholder="Buscar tags..." value={searchTerm} onValueChange={setSearchTerm} />
                <CommandList>
                  <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                  <CommandGroup>
                    {getFilteredTags(searchTerm).map(tag => <CommandItem key={tag.id} onSelect={async () => {
                      try {
                        await addTagToContact(tag.id);
                        await refreshTags();
                        setIsTagPopoverOpen(false);
                        setSearchTerm("");
                      } catch (error) {
                        console.error('Erro ao adicionar tag:', error);
                      }
                    }}>
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-3 h-3 rounded-full" style={{
                          backgroundColor: tag.color
                        }} />
                          <span>{tag.name}</span>
                        </div>
                      </CommandItem>)}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          </div>
          
          {/* ConnectionBadge à direita */}
          {deal.conversation?.connection_id && <div className="flex-shrink-0">
              <ConnectionBadge connectionId={deal.conversation.connection_id} connectionInfo={deal.conversation.connection} />
            </div>}
        </div>
        
        {/* Footer com ícones de ação e prioridade */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-5 w-5 p-0 hover:bg-green-100 hover:text-green-600" onClick={async e => {
            e.stopPropagation();
            console.log('🎯 Clique no botão de chat - Deal:', deal);
            console.log('📞 Contact ID:', deal.contact?.id);

            // Buscar conversa do contato antes de abrir o modal
            if (deal.contact?.id) {
              try {
                console.log('🔍 Buscando conversa para contact_id:', deal.contact.id);
                const {
                  data: conversations,
                  error
                } = await supabase.from('conversations').select('id').eq('contact_id', deal.contact.id).eq('workspace_id', selectedWorkspace?.workspace_id).eq('status', 'open').limit(1);
                console.log('📊 Resultado da busca:', {
                  conversations,
                  error
                });
                if (error) throw error;
                if (conversations && conversations.length > 0) {
                  // Anexar conversation_id ao deal antes de passar para o modal
                  const dealWithConversation = {
                    ...deal,
                    conversation_id: conversations[0].id,
                    conversation: {
                      id: conversations[0].id
                    }
                  };
                  console.log('✅ Conversa encontrada! ID:', conversations[0].id);
                  console.log('📦 Deal com conversa:', dealWithConversation);
                  onChatClick?.(dealWithConversation);
                } else {
                  console.warn('⚠️ Nenhuma conversa encontrada para o contato');
                  toast({
                    title: "Conversa não encontrada",
                    description: "Não há conversa ativa para este contato",
                    variant: "destructive"
                  });
                }
              } catch (error) {
                console.error('❌ Erro ao buscar conversa:', error);
                toast({
                  title: "Erro",
                  description: "Erro ao buscar conversa do contato",
                  variant: "destructive"
                });
              }
            } else {
              console.error('❌ Deal não tem contact_id');
            }
          }}>
              <MessageCircle className="w-3 h-3" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-5 w-5 p-0 hover:bg-blue-100 hover:text-blue-600" onClick={e => e.stopPropagation()}>
                    {deal.responsible_avatar ? (
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-border">
                        <img src={deal.responsible_avatar} alt={deal.responsible} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{deal.responsible?.split(' ')[0] || 'Sem responsável'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5 p-0 hover:bg-purple-100 hover:text-purple-600" 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (deal.conversation?.id && onConfigureAgent) {
                        onConfigureAgent(deal.conversation.id);
                      }
                    }}
                  >
                    <Bot className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configurar Agente IA</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] md:text-xs text-muted-foreground">
              {formatTimeAgo(deal.created_at)}
            </span>
            {deal.priority === 'high' && <div className="flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="w-2.5 h-2.5" />
              </div>}
          </div>
        </div>
      </CardContent>
    </Card>;
}
interface CRMNegociosProps {
  isDarkMode?: boolean;
}

// Componente interno que usa o context
function CRMNegociosContent({
  isDarkMode = false
}: CRMNegociosProps) {
  const {
    selectedWorkspace
  } = useWorkspace();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();
  const {
    canManagePipelines,
    canManageColumns,
    userWorkspaceRole,
    isMaster
  } = useWorkspaceRole();
  
  // Para Masters, priorizar workspaceId da URL
  const effectiveWorkspaceId = isMaster && urlWorkspaceId ? urlWorkspaceId : selectedWorkspace?.workspace_id;
  
  // Debug logs
  useEffect(() => {
    console.log('🔍 CRMNegocios - Role Debug:', {
      userWorkspaceRole,
      isMaster,
      selectedWorkspaceId: selectedWorkspace?.workspace_id,
      canManagePipelines: canManagePipelines(selectedWorkspace?.workspace_id || undefined),
      canManageColumns: canManageColumns(selectedWorkspace?.workspace_id || undefined)
    });
  }, [userWorkspaceRole, isMaster, selectedWorkspace?.workspace_id, canManagePipelines, canManageColumns]);
  const {
    getHeaders
  } = useWorkspaceHeaders();
  const {
    toast
  } = useToast();
  const {
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    createPipeline,
    selectPipeline,
    createColumn,
    createCard,
    moveCard,
    moveCardOptimistic,
    getCardsByColumn,
    updateCard,
    refreshCurrentPipeline
  } = usePipelinesContext();
  const {
    activeUsers,
    isLoading: isLoadingActiveUsers,
    refreshActiveUsers
  } = usePipelineActiveUsers(selectedPipeline?.id);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [selectedChatCard, setSelectedChatCard] = useState<any>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isEditarColunaModalOpen, setIsEditarColunaModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCriarPipelineModalOpen, setIsCriarPipelineModalOpen] = useState(false);
  const [isCriarNegocioModalOpen, setIsCriarNegocioModalOpen] = useState(false);
  const [isDealDetailsModalOpen, setIsDealDetailsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    tags: string[];
    selectedDate?: Date;
    dateRange?: {
      from: Date;
      to: Date;
    };
  } | null>(null);
  const [isTransferirModalOpen, setIsTransferirModalOpen] = useState(false);
  const [selectedColumnForAction, setSelectedColumnForAction] = useState<string | null>(null);
  const [isSetValueModalOpen, setIsSetValueModalOpen] = useState(false);
  const [selectedCardForValue, setSelectedCardForValue] = useState<any>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCardsForTransfer, setSelectedCardsForTransfer] = useState<Set<string>>(new Set());
  const [isEditarContatoModalOpen, setIsEditarContatoModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isVincularProdutoModalOpen, setIsVincularProdutoModalOpen] = useState(false);
  const [selectedCardForProduct, setSelectedCardForProduct] = useState<{
    id: string;
    value: number;
  } | null>(null);
  const [isVincularResponsavelModalOpen, setIsVincularResponsavelModalOpen] = useState(false);
  const [selectedCardForResponsavel, setSelectedCardForResponsavel] = useState<{
    cardId: string;
    conversationId?: string;
    contactId?: string;
    currentResponsibleId?: string;
  } | null>(null);
  const [isDeleteDealModalOpen, setIsDeleteDealModalOpen] = useState(false);
  const [selectedCardForDeletion, setSelectedCardForDeletion] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedConversationForAgent, setSelectedConversationForAgent] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [columnAutomationCounts, setColumnAutomationCounts] = useState<Record<string, number>>({});

  // Buscar agent_active_id quando selectedConversationForAgent mudar
  useEffect(() => {
    const fetchAgentId = async () => {
      if (!selectedConversationForAgent) {
        setCurrentAgentId(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('agent_active_id')
          .eq('id', selectedConversationForAgent)
          .single();

        if (error) throw error;
        setCurrentAgentId(data?.agent_active_id || null);
      } catch (error) {
        console.error('Erro ao buscar agent_active_id:', error);
        setCurrentAgentId(null);
      }
    };

    fetchAgentId();
  }, [selectedConversationForAgent]);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  }));

  // 🔥 Buscar contagens de automações por coluna
  useEffect(() => {
    const fetchAutomationCounts = async () => {
      if (!columns || columns.length === 0) {
        setColumnAutomationCounts({});
        return;
      }

      try {
        const counts: Record<string, number> = {};
        
        // Buscar contagem de automações para cada coluna
        await Promise.all(
          columns.map(async (column) => {
            const { count } = await supabase
              .from('crm_column_automations')
              .select('*', { count: 'exact', head: true })
              .eq('column_id', column.id);
            
            counts[column.id] = count || 0;
          })
        );

        setColumnAutomationCounts(counts);
      } catch (error) {
        console.error('Erro ao buscar contagens de automações:', error);
      }
    };

    fetchAutomationCounts();
  }, [columns]);

  // O loading é gerenciado automaticamente pelo PipelinesContext
  // quando o workspace muda, ele limpa os dados e mostra skeleton
  // Atualizado: 2025-10-03 - removido isRefreshing

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para filtrar cards por coluna
  const getFilteredCards = (columnId: string) => {
    let columnCards = getCardsByColumn(columnId);

    // Filtrar por termo de busca
    if (searchTerm) {
      columnCards = columnCards.filter(card => 
        card.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        card.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.contact?.phone?.includes(searchTerm)
      );
    }

    // 🎯 FILTRAR POR RESPONSÁVEIS SELECIONADOS
    if (selectedResponsibleIds.length > 0) {
      columnCards = columnCards.filter(card => {
        // Verificar se o card tem responsible_user_id nos responsáveis selecionados
        return card.responsible_user_id && selectedResponsibleIds.includes(card.responsible_user_id);
      });
    }

    // Filtrar por tags selecionadas
    if (appliedFilters?.tags && appliedFilters.tags.length > 0) {
      columnCards = columnCards.filter(card => {
        // Verificar tags diretas do card
        const cardTags = Array.isArray(card.tags) ? card.tags : [];
        const hasCardTag = appliedFilters.tags.some(filterTag => cardTags.some(cardTag => cardTag === filterTag));

        // Verificar tags do contato associado
        const contactTags = card.contact?.contact_tags || [];
        const hasContactTag = appliedFilters.tags.some(filterTag => contactTags.some(contactTag => contactTag.tags?.id === filterTag || contactTag.tags?.name === filterTag));
        return hasCardTag || hasContactTag;
      });
    }

    // Filtrar por data
    if (appliedFilters?.selectedDate || appliedFilters?.dateRange) {
      columnCards = columnCards.filter(card => {
        if (!card.created_at) return false;
        const cardDate = new Date(card.created_at);
        cardDate.setHours(0, 0, 0, 0); // Normalizar para início do dia

        if (appliedFilters.selectedDate) {
          // Filtro por data única
          const filterDate = new Date(appliedFilters.selectedDate);
          filterDate.setHours(0, 0, 0, 0);
          return cardDate.getTime() === filterDate.getTime();
        }
        if (appliedFilters.dateRange?.from && appliedFilters.dateRange?.to) {
          // Filtro por período
          const fromDate = new Date(appliedFilters.dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(appliedFilters.dateRange.to);
          toDate.setHours(23, 59, 59, 999); // Até o fim do dia

          return cardDate >= fromDate && cardDate <= toDate;
        }
        return true;
      });
    }
    return columnCards;
  };
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const {
      over
    } = event;
    if (over && over.id.toString().startsWith('column-')) {
      setDragOverColumn(over.id.toString().replace('column-', ''));
    } else {
      setDragOverColumn(null);
    }
  }, []);
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    if (!over) {
      setActiveId(null);
      setDragOverColumn(null);
      return;
    }
    const activeId = active.id as string;
    const overId = over.id as string;

    // Encontrar o card que está sendo movido
    const activeCard = cards.find(card => `card-${card.id}` === activeId);
    if (!activeCard) {
      setActiveId(null);
      setDragOverColumn(null);
      return;
    }

    // Determinar a nova coluna baseado no over
    let newColumnId = overId;

    // Se over é outro card, usar a coluna desse card
    if (overId.startsWith('card-')) {
      const overCard = cards.find(card => `card-${card.id}` === overId);
      if (overCard) {
        newColumnId = overCard.column_id;
      }
    }
    // Se over é uma coluna, usar o id da coluna
    else if (overId.startsWith('column-')) {
      newColumnId = overId.replace('column-', '');
    }

    // 🚀 USAR OPTIMISTIC UPDATE para movimento instantâneo
    if (activeCard.column_id !== newColumnId) {
      console.log('🎯 Iniciando drag fluido:', {
        cardId: activeCard.id,
        from: activeCard.column_id,
        to: newColumnId
      });

      // Não precisa await - deixar executar em background
      moveCardOptimistic(activeCard.id, newColumnId);
    }

    // Limpar estados do drag imediatamente
    setActiveId(null);
    setDragOverColumn(null);
  }, [cards, moveCardOptimistic]);
  const openCardDetails = (card: any) => {
    console.log('🔍 Abrindo detalhes do card:', card);
    console.log('📋 Card completo:', {
      id: card.id,
      title: card.title,
      column_id: card.column_id,
      pipeline_id: card.pipeline_id,
      contact: card.contact
    });
    setSelectedCard(card);
    setIsDealDetailsModalOpen(true);
  };
  const handlePipelineCreate = async (nome: string) => {
    try {
      await createPipeline(nome, 'padrao'); // tipo padrão fixo
      toast({
        title: "Pipeline criado",
        description: `Pipeline "${nome}" criado com sucesso`,
      });
      setIsCriarPipelineModalOpen(false);
    } catch (error) {
      console.error('Erro ao criar pipeline:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o pipeline",
        variant: "destructive",
      });
    }
  };
  const handleColumnCreate = async (nome: string, cor: string) => {
    await createColumn(nome, cor);
  };
  const handleSetCardValue = async (value: number) => {
    if (!selectedCardForValue) return;
    try {
      // Usar a função updateCard do contexto para salvar o valor
      await updateCard(selectedCardForValue.id, {
        value
      });
      toast({
        title: "Sucesso",
        description: "Preço do negócio atualizado com sucesso"
      });
      setSelectedCardForValue(null);
    } catch (error) {
      console.error('Erro ao atualizar valor do card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar preço do negócio",
        variant: "destructive"
      });
    }
  };
  const handleOpenTransferModal = useCallback((cardId: string) => {
    setSelectedCardsForTransfer(new Set([cardId]));
    setIsTransferirModalOpen(true);
  }, []);
  const handleTransferComplete = useCallback(() => {
    setSelectedCardsForTransfer(new Set());
    refreshCurrentPipeline();
  }, [refreshCurrentPipeline]);
  const handleVincularResponsavel = useCallback((cardId: string, conversationId?: string, currentResponsibleId?: string, contactId?: string) => {
    setSelectedCardForResponsavel({
      cardId,
      conversationId,
      contactId,
      currentResponsibleId
    });
    setIsVincularResponsavelModalOpen(true);
  }, []);
  const handleCreateBusiness = async (business: any) => {
    if (!selectedPipeline || !effectiveWorkspaceId) {
      toast({
        title: "Erro",
        description: "Pipeline ou workspace não selecionado",
        variant: "destructive"
      });
      return;
    }
    try {
      // 1. Buscar dados completos do contato
      const {
        data: contact,
        error: contactError
      } = await supabase.from('contacts').select('id, name, phone, profile_image_url').eq('id', business.lead).single();
      if (contactError || !contact?.phone) {
        throw new Error('Contato não encontrado ou sem telefone');
      }

      // 2. Verificar se já existe conversa ativa (para reusar se existir)
      const {
        data: existingConversations,
        error: convError
      } = await supabase.from('conversations').select('id, status').eq('contact_id', business.lead).eq('workspace_id', effectiveWorkspaceId).eq('status', 'open');
      if (convError) {
        console.error('Erro ao verificar conversas existentes:', convError);
      }

      // Se existe conversa, reusar. Se não existe, criar nova
      let conversationId = existingConversations?.[0]?.id;

      // 3. Criar conversa apenas se não existe
      if (!conversationId) {
        const {
          data: conversationData,
          error: conversationError
        } = await supabase.functions.invoke('create-quick-conversation', {
          body: {
            phoneNumber: contact.phone,
            orgId: effectiveWorkspaceId
          }
        });
        if (conversationError) throw conversationError;
        conversationId = conversationData?.conversationId;
      }

      // 4. Validar se a coluna selecionada existe
      const targetColumn = columns.find(col => col.id === business.column);
      if (!targetColumn) {
        throw new Error('Coluna selecionada não encontrada');
      }

      // 5. Criar o card no pipeline com dados do contato
      await createCard({
        column_id: business.column,
        contact_id: business.lead,
        conversation_id: conversationId,
        responsible_user_id: business.responsible,
        value: business.value,
        title: contact.name || 'Novo negócio',
        description: 'Card criado através do formulário de negócios',
        // Passar dados do contato para renderização otimista
        contact: {
          id: contact.id,
          name: contact.name,
          profile_image_url: contact.profile_image_url
        }
      } as any);
      toast({
        title: "Sucesso",
        description: "Negócio criado com sucesso!"
      });
      setIsCriarNegocioModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao criar negócio:', error);
      
      // Verificar se é erro de duplicação (do trigger ou da edge function)
      const errorMessage = error?.message || error?.context?.body?.message || '';
      const isDuplicateError = 
        errorMessage.includes('Já existe um card aberto') || 
        errorMessage.includes('duplicate_open_card') ||
        error?.context?.body?.error === 'duplicate_open_card';
      
      if (isDuplicateError) {
        toast({
          title: "Negócio já existe",
          description: "Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao criar negócio",
          variant: "destructive"
        });
      }
    }
  };
  if (!effectiveWorkspaceId) {
    return <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecione um workspace para continuar</p>
        </div>
      </div>;
  }

  // Show debug panel if loading or no pipelines found
  if (isLoading || pipelines.length === 0) {
    return <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Negócios</h1>
            <p className="text-muted-foreground">Gerencie seus negócios no pipeline de vendas</p>
          </div>
          {!isLoading && canManagePipelines(effectiveWorkspaceId) && <Button onClick={() => setIsCriarPipelineModalOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Criar Pipeline
            </Button>}
        </div>
        
        {isLoading ? <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div> : <div className="text-center py-12">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Nenhum pipeline encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              {canManagePipelines(selectedWorkspace?.workspace_id) ? "Crie seu primeiro pipeline para começar a gerenciar seus negócios" : "Nenhum pipeline disponível no momento"}
            </p>
            {canManagePipelines(selectedWorkspace?.workspace_id) && <Button onClick={() => setIsCriarPipelineModalOpen(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Criar Pipeline
              </Button>}
          </div>}
        
        <CriarPipelineModal isOpen={isCriarPipelineModalOpen} onClose={() => setIsCriarPipelineModalOpen(false)} onSave={handlePipelineCreate} />
      </div>;
  }

  // Mostrar loading quando estiver carregando pipelines
  if (isLoading) {
    return <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-sm">Carregando pipelines...</p>
          </div>
        </div>
      </div>;
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      <main className="h-screen flex flex-col w-full overflow-hidden">
        
        {/* CARD DE FILTROS */}
        <div className="sticky top-0 z-10 px-4 py-2 flex-shrink-0">
          <div className={cn("flex items-center bg-background border rounded-lg p-3 shadow-sm", isDarkMode ? "bg-card border-border" : "bg-background border-border")}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Settings Button */}
              {canManagePipelines(selectedWorkspace?.workspace_id || undefined) && <Button size="icon" variant="ghost" className="h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0" onClick={() => setIsConfigModalOpen(true)} disabled={!selectedPipeline}>
                  <Settings className="w-5 h-5" />
                </Button>}
              
              {/* Pipeline Selector */}
              <div className="mr-2 flex-shrink-0">
                {isLoading ? (
                  <Skeleton className="h-10 w-[200px]" />
                ) : pipelines && pipelines.length > 0 ? (
                  <Select 
                    value={selectedPipeline?.id || ""} 
                    onValueChange={(value) => {
                      const pipeline = pipelines.find(p => p.id === value);
                      if (pipeline) {
                        selectPipeline(pipeline);
                      }
                    }}
                  >
                    <SelectTrigger className={cn("w-[200px] h-10 font-bold", isDarkMode ? "bg-card text-white border-border" : "bg-background")}>
                      <SelectValue placeholder="Selecione um pipeline" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background">
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-muted-foreground px-3 py-2">Nenhum pipeline</span>
                )}
              </div>

              {/* Criar Pipeline e Filtrar Buttons */}
              <div className="relative flex-shrink-0 flex items-center gap-2">
                {canManagePipelines(selectedWorkspace?.workspace_id || undefined) && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-10 w-10 p-0 text-primary hover:bg-primary/10"
                    onClick={() => setIsCriarPipelineModalOpen(true)}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                )}
                <Button size="sm" className={cn("font-medium relative", appliedFilters?.tags && appliedFilters.tags.length > 0 || appliedFilters?.selectedDate || appliedFilters?.dateRange ? "bg-warning text-warning-foreground hover:bg-warning/90" : "bg-primary text-primary-foreground hover:bg-primary/90")} onClick={() => setIsFilterModalOpen(true)} disabled={!selectedPipeline}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar
                  {(appliedFilters?.tags && appliedFilters.tags.length > 0 || appliedFilters?.selectedDate || appliedFilters?.dateRange) && <Badge className="ml-2 bg-background text-primary text-xs px-1 py-0 h-auto">
                      {(appliedFilters?.tags?.length || 0) + (appliedFilters?.selectedDate || appliedFilters?.dateRange ? 1 : 0)}
                    </Badge>}
                </Button>
              </div>
              
              {/* Visualizar mensagens Button */}
              
              
              {/* Search Input */}
              <div className="relative flex-shrink-0 flex-1 max-w-xs">
                <Search className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4", isDarkMode ? "text-gray-400" : "text-gray-500")} />
                <Input placeholder="Buscar negócios..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={cn("pl-10 h-10 border-gray-300 bg-transparent", isDarkMode ? "border-gray-600 text-white placeholder:text-gray-400" : "")} />
              </div>
              
              {/* Avatar Group - Usuários com conversas ativas */}
              <ActiveUsersAvatars 
                users={activeUsers} 
                isLoading={isLoadingActiveUsers} 
                maxVisible={5} 
                className="ml-2 flex-shrink-0"
                selectedUserIds={selectedResponsibleIds}
                onUserClick={(userId) => {
                  setSelectedResponsibleIds(prev => {
                    if (prev.includes(userId)) {
                      // Remove do filtro se já estiver selecionado
                      return prev.filter(id => id !== userId);
                    } else {
                      // Adiciona ao filtro
                      return [...prev, userId];
                    }
                  });
                }}
              />
              
              {/* Botão Apagar Filtros - aparece quando há filtros ativos */}
              {selectedResponsibleIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedResponsibleIds([])}
                  className="ml-2 flex-shrink-0 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Apagar filtros
                </Button>
              )}
            </div>
            
            {/* + Coluna Button - Only show if pipeline exists and user can manage columns */}
            {selectedPipeline && canManageColumns(selectedWorkspace?.workspace_id || undefined) && <Button size="sm" className={cn("bg-primary text-primary-foreground hover:bg-primary/90 font-medium ml-4 flex-shrink-0")} onClick={() => setIsAddColumnModalOpen(true)}>
                + Coluna
              </Button>}
          </div>
        </div>

        {/* CONTAINER DO PIPELINE */}
        <div className="flex-1 min-h-0">
          <div className="h-full overflow-x-auto px-4">
            {isLoading ? <div className="flex gap-1.5 sm:gap-3 h-full min-w-full">
              {[...Array(4)].map((_, index) => <div key={index} className="w-60 sm:w-68 flex-shrink-0 h-full">
                  <div className="bg-card rounded-lg border border-t-4 border-t-gray-400 h-full">
                    <div className="p-4 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <div className="p-3 pt-0 space-y-3">
                      {[...Array(3)].map((_, cardIndex) => <div key={cardIndex} className="bg-muted/20 rounded-lg p-4 space-y-2">
                          <Skeleton className="h-5 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex justify-between items-center mt-3">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>)}
                    </div>
                  </div>
                </div>)}
            </div> : !selectedPipeline ? <div className="flex items-center justify-center h-64 border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Nenhum pipeline selecionado</p>
                <Button onClick={() => setIsCriarPipelineModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Pipeline
                </Button>
              </div>
              </div> : isLoadingColumns ?
          // Skeleton loading para colunas
          <div className="flex gap-1.5 sm:gap-3 h-full min-w-full">
              {[...Array(3)].map((_, index) => <div key={index} className="w-60 sm:w-68 flex-shrink-0 h-full">
                  <div className="bg-card rounded-lg border border-t-4 h-full flex flex-col">
                    <div className="p-4 pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="flex-1 p-3 pt-0 space-y-3">
                      {[...Array(3)].map((_, cardIndex) => <div key={cardIndex} className="bg-muted/20 rounded-lg p-4 space-y-2">
                          <div className="flex items-start gap-3 mb-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-20" />
                              </div>
                            </div>
                          </div>
                          <div className="mb-3">
                            <Skeleton className="h-4 w-16" />
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <div className="flex gap-1">
                              <Skeleton className="h-6 w-6" />
                              <Skeleton className="h-6 w-6" />
                            </div>
                            <Skeleton className="h-4 w-12" />
                          </div>
                        </div>)}
                    </div>
                  </div>
                </div>)}
              </div> : <div className="flex gap-1.5 sm:gap-3 h-full min-w-full">
                {columns.map(column => {
            const columnCards = getFilteredCards(column.id);

            // Calculate total value of cards in this column
            const calculateColumnTotal = () => {
              return columnCards.reduce((total, card) => total + (card.value || 0), 0);
            };
            const formatCurrency = (value: number) => {
              return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(value);
            };
            return <DroppableColumn key={column.id} id={`column-${column.id}`}>
                    <div className="w-60 sm:w-72 flex-shrink-0 h-full">
                       <div className={cn("bg-card rounded-lg border border-t-4 h-full flex flex-col border-b-2 border-b-primary", `border-t-[${column.color}]`)} style={{
                  borderTopColor: column.color
                }}>
                        {/* Cabeçalho da coluna - fundo branco/claro */}
                        <div className="bg-white p-4 pb-3 flex-shrink-0 rounded-t border-b border-border/20">
                          {isSelectionMode && selectedColumnForAction === column.id ? <div className="mb-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={columnCards.length > 0 && columnCards.every(card => selectedCardsForTransfer.has(card.id))} onChange={e => {
                            const newSet = new Set(selectedCardsForTransfer);
                            columnCards.forEach(card => {
                              if (e.target.checked) {
                                newSet.add(card.id);
                              } else {
                                newSet.delete(card.id);
                              }
                            });
                            setSelectedCardsForTransfer(newSet);
                          }} className="w-4 h-4 cursor-pointer" />
                                    <span className="font-medium">Selecionar todos</span>
                                  </label>
                                  <Button size="sm" variant="ghost" onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedCardsForTransfer(new Set());
                          setSelectedColumnForAction(null);
                        }}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                {selectedCardsForTransfer.size > 0 && <Button onClick={() => setIsTransferirModalOpen(true)} className="w-full" size="sm">
                                    Transferir ({selectedCardsForTransfer.size})
                                  </Button>}
                              </div> : null}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground text-base mb-1">
                                {column.name}
                              </h3>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="font-medium">
                                  Total: {formatCurrency(calculateColumnTotal())}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>
                                    {columnCards.length} {columnCards.length === 1 ? 'negócio' : 'negócios'}
                                  </span>
                                  {columnAutomationCounts[column.id] > 0 && (
                                     <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 30 30" fill="currentColor">
                                              <path d="M 19.664062 0 C 19.423063 0 19.217828 0.17120313 19.173828 0.40820312 L 18.953125 1.5839844 C 18.896125 1.8889844 18.654609 2.1166875 18.349609 2.1796875 C 18.065609 2.2386875 17.785672 2.3123906 17.513672 2.4003906 C 17.218672 2.4963906 16.897313 2.4205469 16.695312 2.1855469 L 15.919922 1.2792969 C 15.762922 1.0962969 15.498062 1.0528281 15.289062 1.1738281 L 14.710938 1.5078125 C 14.502937 1.6278125 14.408281 1.8804219 14.488281 2.1074219 L 14.884766 3.234375 C 14.987766 3.526375 14.893109 3.8437813 14.662109 4.0507812 C 14.447109 4.2437812 14.243781 4.4471094 14.050781 4.6621094 C 13.843781 4.8931094 13.526375 4.9897187 13.234375 4.8867188 L 12.105469 4.4882812 C 11.878469 4.4082812 11.627813 4.5019375 11.507812 4.7109375 L 11.171875 5.2910156 C 11.051875 5.4990156 11.097297 5.764875 11.279297 5.921875 L 11.376953 6.0058594 C 12.559953 6.0258594 13.572016 6.8720625 13.791016 8.0390625 L 13.851562 8.3574219 L 14.060547 8.1113281 C 14.519547 7.5773281 15.162172 7.2869531 15.826172 7.2519531 C 16.722172 5.8969531 18.255 5 20 5 C 22.761 5 25 7.239 25 10 C 25 11.745 24.103047 13.277875 22.748047 14.171875 C 22.713047 14.835875 22.422672 15.4795 21.888672 15.9375 L 21.642578 16.146484 L 21.960938 16.207031 C 23.127938 16.426031 23.974141 17.438094 23.994141 18.621094 L 24.078125 18.71875 C 24.235125 18.90175 24.499984 18.947172 24.708984 18.826172 L 25.289062 18.490234 C 25.497062 18.370234 25.591719 18.119578 25.511719 17.892578 L 25.113281 16.763672 C 25.010281 16.471672 25.106891 16.154266 25.337891 15.947266 C 25.552891 15.754266 25.756219 15.550938 25.949219 15.335938 C 26.156219 15.104938 26.473625 15.010281 26.765625 15.113281 L 27.892578 15.509766 C 28.119578 15.589766 28.372187 15.496109 28.492188 15.287109 L 28.826172 14.707031 C 28.946172 14.499031 28.902703 14.235125 28.720703 14.078125 L 27.814453 13.300781 C 27.579453 13.098781 27.503609 12.777422 27.599609 12.482422 C 27.687609 12.210422 27.761312 11.932438 27.820312 11.648438 C 27.883312 11.344437 28.111016 11.102922 28.416016 11.044922 L 29.591797 10.822266 C 29.828797 10.781266 30 10.576938 30 10.335938 L 30 9.6640625 C 30 9.4230625 29.828797 9.2178281 29.591797 9.1738281 L 28.416016 8.953125 C 28.111016 8.896125 27.883312 8.6546094 27.820312 8.3496094 C 27.761312 8.0656094 27.687609 7.7856719 27.599609 7.5136719 C 27.503609 7.2186719 27.579453 6.8973125 27.814453 6.6953125 L 28.720703 5.9199219 C 28.903703 5.7629219 28.947172 5.4980625 28.826172 5.2890625 L 28.492188 4.7109375 C 28.372187 4.5029375 28.119578 4.4082812 27.892578 4.4882812 L 26.765625 4.8847656 C 26.473625 4.9877656 26.156219 4.8931094 25.949219 4.6621094 C 25.756219 4.4471094 25.552891 4.2437813 25.337891 4.0507812 C 25.106891 3.8437813 25.010281 3.526375 25.113281 3.234375 L 25.511719 2.1054688 C 25.591719 1.8784687 25.498063 1.6278125 25.289062 1.5078125 L 24.708984 1.171875 C 24.500984 1.051875 24.235125 1.0972969 24.078125 1.2792969 L 23.302734 2.1855469 C 23.100734 2.4205469 22.779375 2.4963906 22.484375 2.4003906 C 22.212375 2.3123906 21.932438 2.2386875 21.648438 2.1796875 C 21.344438 2.1166875 21.102922 1.8870312 21.044922 1.5820312 L 20.824219 0.40625 C 20.782219 0.17025 20.576937 0 20.335938 0 L 19.664062 0 z M 10.664062 8 C 10.423063 8 10.217828 8.17025 10.173828 8.40625 L 9.9882812 9.3945312 C 9.9112813 9.8055313 9.5838281 10.108406 9.1738281 10.191406 C 8.8328281 10.260406 8.497875 10.348078 8.171875 10.455078 C 7.775875 10.585078 7.3413125 10.487875 7.0703125 10.171875 L 6.4199219 9.4121094 C 6.2629219 9.2301094 5.9970625 9.1866406 5.7890625 9.3066406 L 5.2109375 9.640625 C 5.0019375 9.760625 4.9082812 10.013234 4.9882812 10.240234 L 5.3242188 11.191406 C 5.4622188 11.585406 5.3305312 12.009109 5.0195312 12.287109 C 4.7625312 12.517109 4.5180625 12.760578 4.2890625 13.017578 C 4.0110625 13.328578 3.5873594 13.460266 3.1933594 13.322266 L 2.2402344 12.988281 C 2.0132344 12.908281 1.7625781 13.002937 1.6425781 13.210938 L 1.3066406 13.789062 C 1.1856406 13.998062 1.2310625 14.262922 1.4140625 14.419922 L 2.1738281 15.070312 C 2.4898281 15.341313 2.5870312 15.775875 2.4570312 16.171875 C 2.3500312 16.497875 2.2623594 16.832828 2.1933594 17.173828 C 2.1103594 17.583828 1.8074844 17.911281 1.3964844 17.988281 L 0.40820312 18.173828 C 0.17120313 18.217828 0 18.423063 0 18.664062 L 0 19.335938 C 0 19.576937 0.17025 19.782172 0.40625 19.826172 L 1.3945312 20.011719 C 1.8055312 20.088719 2.1084062 20.416172 2.1914062 20.826172 C 2.2604063 21.168172 2.3480781 21.502125 2.4550781 21.828125 C 2.5850781 22.224125 2.487875 22.658687 2.171875 22.929688 L 1.4121094 23.580078 C 1.2301094 23.737078 1.1866406 24.002938 1.3066406 24.210938 L 1.640625 24.789062 C 1.760625 24.998062 2.0132344 25.091719 2.2402344 25.011719 L 3.1914062 24.675781 C 3.5854063 24.537781 4.0091094 24.669469 4.2871094 24.980469 C 4.5171094 25.237469 4.7605781 25.481938 5.0175781 25.710938 C 5.3285781 25.988937 5.4602656 26.412641 5.3222656 26.806641 L 4.9882812 27.759766 C 4.9082812 27.986766 5.0029375 28.237422 5.2109375 28.357422 L 5.7890625 28.693359 C 5.9980625 28.814359 6.2629219 28.768937 6.4199219 28.585938 L 7.0703125 27.826172 C 7.3413125 27.510172 7.775875 27.412969 8.171875 27.542969 C 8.497875 27.649969 8.8328281 27.737641 9.1738281 27.806641 C 9.5838281 27.889641 9.9112813 28.192516 9.9882812 28.603516 L 10.173828 29.591797 C 10.217828 29.828797 10.423063 30 10.664062 30 L 11.335938 30 C 11.576938 30 11.782219 29.82875 11.824219 29.59375 L 12.009766 28.605469 C 12.086766 28.194469 12.414219 27.891594 12.824219 27.808594 C 13.166219 27.739594 13.500172 27.651922 13.826172 27.544922 C 14.222172 27.414922 14.656734 27.512125 14.927734 27.828125 L 15.578125 28.587891 C 15.735125 28.769891 15.999031 28.815313 16.207031 28.695312 L 16.787109 28.359375 C 16.996109 28.239375 17.089766 27.988719 17.009766 27.761719 L 16.675781 26.808594 C 16.537781 26.414594 16.669469 25.990891 16.980469 25.712891 C 17.237469 25.482891 17.481938 25.239422 17.710938 24.982422 C 17.988937 24.671422 18.413641 24.539734 18.806641 24.677734 L 19.759766 25.011719 C 19.986766 25.091719 20.237422 24.997062 20.357422 24.789062 L 20.693359 24.210938 C 20.814359 24.001937 20.768937 23.737078 20.585938 23.580078 L 19.826172 22.929688 C 19.510172 22.658688 19.412969 22.224125 19.542969 21.828125 C 19.649969 21.502125 19.737641 21.167172 19.806641 20.826172 C 19.889641 20.416172 20.192516 20.088719 20.603516 20.011719 L 21.591797 19.826172 C 21.828797 19.782172 22 19.576937 22 19.335938 L 22 18.664062 C 22 18.423063 21.82875 18.218781 21.59375 18.175781 L 20.605469 17.990234 C 20.194469 17.913234 19.891594 17.583828 19.808594 17.173828 C 19.739594 16.832828 19.651922 16.497875 19.544922 16.171875 C 19.414922 15.775875 19.512125 15.343266 19.828125 15.072266 L 20.587891 14.421875 C 20.769891 14.264875 20.815313 13.999016 20.695312 13.791016 L 20.359375 13.210938 C 20.239375 13.001937 19.988719 12.908281 19.761719 12.988281 L 18.808594 13.324219 C 18.414594 13.462219 17.990891 13.330531 17.712891 13.019531 C 17.482891 12.762531 17.239422 12.518062 16.982422 12.289062 C 16.671422 12.011063 16.539734 11.587359 16.677734 11.193359 L 17.011719 10.240234 C 17.091719 10.013234 16.997062 9.7625781 16.789062 9.6425781 L 16.210938 9.3066406 C 16.001938 9.1856406 15.737078 9.2310625 15.580078 9.4140625 L 14.929688 10.173828 C 14.658687 10.489828 14.224125 10.587031 13.828125 10.457031 C 13.502125 10.350031 13.167172 10.262359 12.826172 10.193359 C 12.416172 10.110359 12.088719 9.8074844 12.011719 9.3964844 L 11.826172 8.4082031 C 11.782172 8.1712031 11.576937 8 11.335938 8 L 10.664062 8 z M 20 9 A 1 1 0 0 0 19 10 A 1 1 0 0 0 20 11 A 1 1 0 0 0 21 10 A 1 1 0 0 0 20 9 z M 11 13 C 14.314 13 17 15.686 17 19 C 17 22.314 14.314 25 11 25 C 7.686 25 5 22.314 5 19 C 5 15.686 7.686 13 11 13 z M 11 17 C 9.895 17 9 17.895 9 19 C 9 20.105 9.895 21 11 21 C 12.105 21 13 20.105 13 19 C 13 17.895 12.105 17 11 17 z" />
                                            </svg>
                                            <span className="text-xs font-medium">
                                              {columnAutomationCounts[column.id]}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>
                                            {columnAutomationCounts[column.id]} {columnAutomationCounts[column.id] === 1 ? 'automação ativa' : 'automações ativas'}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => setIsCriarNegocioModalOpen(true)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Novo negócio
                                </DropdownMenuItem>
                                {canManageColumns(selectedWorkspace?.workspace_id || undefined) && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedColumnForAction(column.id);
                                    setIsEditarColunaModalOpen(true);
                                  }}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar coluna
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setSelectedColumnForAction(column.id);
                                  setIsSelectionMode(true);
                                  setSelectedCardsForTransfer(new Set());
                                }}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Transferir negócios
                                </DropdownMenuItem>
                                {canManageColumns(selectedWorkspace?.workspace_id || undefined) && (
                                  <DropdownMenuItem onClick={() => {
                                    // Exportar CSV da coluna
                                    const columnCards = getCardsByColumn(column.id);
                                    const csvData = columnCards.map(card => ({
                                      'Título': card.title,
                                      'Preço': card.value || 0,
                                      'Status': card.status,
                                      'Responsável': card.responsible_user?.name || 'Não atribuído',
                                      'Criado em': new Date(card.created_at).toLocaleDateString('pt-BR')
                                    }));
                                    const csv = [Object.keys(csvData[0] || {}).join(','), ...csvData.map(row => Object.values(row).join(','))].join('\n');
                                    const blob = new Blob([csv], {
                                      type: 'text/csv;charset=utf-8;'
                                    });
                                    const link = document.createElement('a');
                                    const url = URL.createObjectURL(blob);
                                    link.setAttribute('href', url);
                                    link.setAttribute('download', `${column.name}_negocios.csv`);
                                    link.style.visibility = 'hidden';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar CSV
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        {/* Corpo da coluna - fundo colorido */}
                        <div className={cn("flex-1 p-3 pt-4 overflow-y-auto min-h-0", dragOverColumn === column.id ? "opacity-90" : "")} style={{
                    backgroundColor: `${column.color}10`
                  }}>
                          {columnCards.length === 0 ? <div className="flex items-center justify-center h-32 text-center">
                              <p className="text-muted-foreground text-sm">
                                Nenhum negócio encontrado nesta etapa
                              </p>
                            </div> : <div className="space-y-2 md:space-y-2.5">
                              <SortableContext items={columnCards.map(card => `card-${card.id}`)} strategy={verticalListSortingStrategy}>
                                {columnCards.map(card => {
                          const deal: Deal = {
                            id: card.id,
                            name: card.title,
                            value: card.value || 0,
                            stage: column.name,
                            responsible: card.responsible_user?.name || (card.conversation?.assigned_user_id ? "Atribuído" : "Não atribuído"),
                            responsible_user_id: card.responsible_user_id,
                            responsible_avatar: card.responsible_user?.avatar,
                            tags: Array.isArray(card.tags) ? card.tags : [],
                            priority: 'medium',
                            created_at: card.created_at,
                            contact: card.contact,
                            conversation: card.conversation || (card.conversation_id ? {
                              id: card.conversation_id
                            } : undefined)
                          };
                          return <DraggableDeal key={card.id} deal={deal} isDarkMode={isDarkMode} onClick={() => !isSelectionMode && openCardDetails(card)} columnColor={column.color} onOpenTransferModal={handleOpenTransferModal} onVincularResponsavel={handleVincularResponsavel} onChatClick={dealData => {
                            console.log('🎯 CRM: Abrindo chat para deal:', dealData);
                            console.log('🆔 CRM: Deal ID:', dealData.id);
                            console.log('🗣️ CRM: Deal conversation:', dealData.conversation);
                            console.log('👤 CRM: Deal contact:', dealData.contact);
                            setSelectedChatCard(dealData);
                            setIsChatModalOpen(true);
                          }} onValueClick={dealData => {
                            setSelectedCardForValue(dealData);
                            setIsSetValueModalOpen(true);
                          }} onConfigureAgent={(conversationId) => {
                            setSelectedConversationForAgent(conversationId);
                            setAgentModalOpen(true);
                          }} isSelectionMode={isSelectionMode && selectedColumnForAction === column.id} isSelected={selectedCardsForTransfer.has(card.id)} onToggleSelection={() => {
                            const newSet = new Set(selectedCardsForTransfer);
                            if (newSet.has(card.id)) {
                              newSet.delete(card.id);
                            } else {
                              newSet.add(card.id);
                            }
                            setSelectedCardsForTransfer(newSet);
                          }} onEditContact={contactId => {
                            setSelectedContactId(contactId);
                            setIsEditarContatoModalOpen(true);
                          }} onLinkProduct={(cardId, currentValue) => {
                            setSelectedCardForProduct({
                              id: cardId,
                              value: currentValue
                            });
                            setIsVincularProdutoModalOpen(true);
                          }} onDeleteCard={cardId => {
                            const card = cards.find(c => c.id === cardId);
                            setSelectedCardForDeletion({
                              id: cardId,
                              name: card?.title || 'este negócio'
                            });
                            setIsDeleteDealModalOpen(true);
                          }} />;
                        })}
                                
                                {/* Invisible drop zone for empty columns and bottom of lists */}
                                <div className="min-h-[40px] w-full" />
                              </SortableContext>
                            </div>}
                        </div>
                       </div>
                     </div>
                   </DroppableColumn>;
          })}
            </div>}
          </div>
        </div>

        <DragOverlay>
          {activeId && (() => {
          const activeCard = cards.find(card => `card-${card.id}` === activeId);
          if (activeCard) {
            const activeColumn = columns.find(col => col.id === activeCard.column_id);
            const deal: Deal = {
              id: activeCard.id,
              name: activeCard.title,
              value: activeCard.value || 0,
              stage: activeColumn?.name || "",
              responsible: activeCard.responsible_user?.name || (activeCard.conversation?.assigned_user_id ? "Atribuído" : "Não atribuído"),
              responsible_avatar: activeCard.responsible_user?.avatar,
              tags: Array.isArray(activeCard.tags) ? activeCard.tags : [],
              priority: 'medium',
              created_at: activeCard.created_at,
              contact: activeCard.contact,
              conversation: activeCard.conversation || (activeCard.conversation_id ? {
                id: activeCard.conversation_id
              } : undefined)
            };
            return <DraggableDeal deal={deal} isDarkMode={isDarkMode} onClick={() => {}} columnColor={activeColumn?.color} onChatClick={dealData => {
              console.log('🎯 CRM DragOverlay: Abrindo chat para deal:', dealData);
              setSelectedChatCard(dealData);
              setIsChatModalOpen(true);
            }} onValueClick={dealData => {
              setSelectedCardForValue(dealData);
              setIsSetValueModalOpen(true);
            }} onConfigureAgent={(conversationId) => {
              setSelectedConversationForAgent(conversationId);
              setAgentModalOpen(true);
            }} />;
          }
          return null;
        })()}
        </DragOverlay>
      </main>

      {/* Modais */}
      <AddColumnModal open={isAddColumnModalOpen} onOpenChange={setIsAddColumnModalOpen} onAddColumn={handleColumnCreate} isDarkMode={isDarkMode} />

      <PipelineConfigModal open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen} onColumnsReorder={newOrder => {
      // Implementar reordenação se necessário
    }} />

      <FilterModal open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen} onApplyFilters={filters => {
      setAppliedFilters({
        tags: filters.tags,
        selectedDate: filters.selectedDate,
        dateRange: filters.dateRange
      });
    }} />

      <CriarPipelineModal isOpen={isCriarPipelineModalOpen} onClose={() => setIsCriarPipelineModalOpen(false)} onSave={handlePipelineCreate} />

      <CriarNegocioModal isOpen={isCriarNegocioModalOpen} onClose={() => setIsCriarNegocioModalOpen(false)} onCreateBusiness={handleCreateBusiness} isDarkMode={isDarkMode} onResponsibleUpdated={() => {
      console.log('🔄 Negócio criado com responsável, refreshing active users...');
      refreshActiveUsers();
    }} />

      {selectedCard && <DealDetailsModal isOpen={isDealDetailsModalOpen} onClose={() => setIsDealDetailsModalOpen(false)} dealName={selectedCard.title || ""} contactNumber={selectedCard.contact?.phone || ""} isDarkMode={isDarkMode} cardId={selectedCard.id} currentColumnId={selectedCard.column_id} currentPipelineId={selectedCard.pipeline_id} contactData={selectedCard.contact} />}

      <ChatModal isOpen={isChatModalOpen} onClose={() => {
      console.log('🔽 Fechando ChatModal');
      setIsChatModalOpen(false);
    }} conversationId={selectedChatCard?.conversation?.id || selectedChatCard?.conversation_id || ""} contactName={selectedChatCard?.contact?.name || selectedChatCard?.name || ""} contactPhone={selectedChatCard?.contact?.phone || ""} contactAvatar={selectedChatCard?.contact?.profile_image_url || ""} contactId={selectedChatCard?.contact?.id || ""} />

      <TransferirModal isOpen={isTransferirModalOpen} onClose={() => {
      setIsTransferirModalOpen(false);
      setSelectedColumnForAction(null);
      setIsSelectionMode(false);
      setSelectedCardsForTransfer(new Set());
    }} selectedCards={Array.from(selectedCardsForTransfer)} currentPipelineId={selectedPipeline?.id || ""} currentPipelineName={selectedPipeline?.name || ""} onTransferComplete={() => {
      refreshCurrentPipeline();
      setIsSelectionMode(false);
      setSelectedCardsForTransfer(new Set());
      setSelectedColumnForAction(null);
    }} isDarkMode={isDarkMode} />

      <SetValueModal isOpen={isSetValueModalOpen} onClose={() => {
      setIsSetValueModalOpen(false);
      setSelectedCardForValue(null);
    }} onSave={handleSetCardValue} currentValue={selectedCardForValue?.value || 0} isDarkMode={isDarkMode} />

      <EditarColunaModal open={isEditarColunaModalOpen} onOpenChange={setIsEditarColunaModalOpen} columnId={selectedColumnForAction} columnName={columns.find(c => c.id === selectedColumnForAction)?.name || ''} columnColor={columns.find(c => c.id === selectedColumnForAction)?.color || '#000000'} onUpdate={() => {
      refreshCurrentPipeline();
    }} />

      <EditarContatoModal isOpen={isEditarContatoModalOpen} onClose={() => {
      setIsEditarContatoModalOpen(false);
      setSelectedContactId(null);
    }} contactId={selectedContactId} onContactUpdated={() => refreshCurrentPipeline()} />

      <VincularProdutoModal isOpen={isVincularProdutoModalOpen} onClose={() => {
      setIsVincularProdutoModalOpen(false);
      setSelectedCardForProduct(null);
    }} cardId={selectedCardForProduct?.id || null} currentValue={selectedCardForProduct?.value || 0} onProductLinked={() => refreshCurrentPipeline()} />

      <VincularResponsavelModal isOpen={isVincularResponsavelModalOpen} onClose={() => {
      setIsVincularResponsavelModalOpen(false);
      setSelectedCardForResponsavel(null);
    }} cardId={selectedCardForResponsavel?.cardId || ""} conversationId={selectedCardForResponsavel?.conversationId} contactId={selectedCardForResponsavel?.contactId} currentResponsibleId={selectedCardForResponsavel?.currentResponsibleId} onSuccess={() => refreshCurrentPipeline()} onResponsibleUpdated={() => {
      console.log('🔄 Responsável atualizado, refreshing active users...');
      refreshActiveUsers();
    }} />

      <ChangeAgentModal 
        open={agentModalOpen} 
        onOpenChange={setAgentModalOpen} 
        conversationId={selectedConversationForAgent || ''}
        currentAgentId={currentAgentId}
        onAgentChanged={() => {
          queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] });
          queryClient.invalidateQueries({ queryKey: ['conversation-agent'] });
        }}
      />

      <DeleteDealModal isOpen={isDeleteDealModalOpen} onClose={() => {
      setIsDeleteDealModalOpen(false);
      setSelectedCardForDeletion(null);
    }} onConfirm={async () => {
      if (!selectedCardForDeletion) return;
      try {
        const headers = getHeaders();
        const {
          data,
          error
        } = await supabase.functions.invoke(`pipeline-management/cards?id=${selectedCardForDeletion.id}`, {
          method: 'DELETE',
          headers
        });
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Negócio excluído permanentemente"
        });
        refreshCurrentPipeline();
      } catch (error) {
        console.error('Erro ao excluir negócio:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao excluir negócio",
          variant: "destructive"
        });
      } finally {
        setIsDeleteDealModalOpen(false);
        setSelectedCardForDeletion(null);
      }
    }} dealName={selectedCardForDeletion?.name} />
    </DndContext>;
}

// Componente exportado com Provider
export function CRMNegocios(props: CRMNegociosProps) {
  return (
    <PipelinesProvider>
      <CRMNegociosContent {...props} />
    </PipelinesProvider>
  );
}