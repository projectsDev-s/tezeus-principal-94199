import React, { useState, useCallback, useEffect } from "react";
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConnectionBadge } from "@/components/chat/ConnectionBadge";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter, DragOverEvent, Active, Over } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Search, Plus, Filter, Eye, MoreHorizontal, Phone, MessageCircle, MessageSquare, Calendar, DollarSign, User, EyeOff, Folder, AlertTriangle, Check, MoreVertical, Edit, Download, ArrowRight, X, Tag } from "lucide-react";
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

// Interface compatível com o componente existente
interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  responsible: string;
  responsible_user_id?: string;
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
    connection?: {
      id: string;
      instance_name: string;
      phone_number?: string;
      status: string;
      metadata?: any;
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
  onVincularResponsavel
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
    transition
  } = useSortable({
    id: `card-${deal.id}`
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
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
            <h3 className={cn("text-xs font-medium truncate flex-1 min-w-0", "text-foreground")}>
              {deal.contact?.name || deal.name}
            </h3>
            
            {/* Produto + Valor à direita */}
            <div className="flex items-center gap-1 text-xs flex-shrink-0">
              {deal.product_name && <span className="text-muted-foreground truncate max-w-[80px]">
                  {deal.product_name}
                </span>}
              {deal.value > 0 ? <span className={cn("font-medium cursor-pointer hover:underline", "text-primary")} onClick={e => {
              e.stopPropagation();
              onValueClick?.(deal);
            }}>
                  {formatCurrency(deal.value)}
                </span> : <span className={cn("font-medium cursor-pointer hover:underline text-muted-foreground")} onClick={e => {
              e.stopPropagation();
              onValueClick?.(deal);
            }}>
                  +valor
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
                    <User className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{deal.responsible?.split(' ')[0] || 'Sem responsável'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] md:text-xs text-muted-foreground">
              {formatTimeAgo(deal.created_at)}
            </span>
            {deal.priority === 'high' && <div className="flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full bg-orange-100 text-orange-600">
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
  const {
    canManagePipelines,
    canManageColumns
  } = useWorkspaceRole();
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
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  }));

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
      columnCards = columnCards.filter(card => card.title.toLowerCase().includes(searchTerm.toLowerCase()) || card.description?.toLowerCase().includes(searchTerm.toLowerCase()));
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
  const handlePipelineCreate = async (nome: string, tipo: string) => {
    await createPipeline(nome, tipo);
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
        description: "Valor do negócio atualizado com sucesso"
      });
      setSelectedCardForValue(null);
    } catch (error) {
      console.error('Erro ao atualizar valor do card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar valor do negócio",
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
    if (!selectedPipeline || !selectedWorkspace) {
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
      } = await supabase.from('conversations').select('id, status').eq('contact_id', business.lead).eq('workspace_id', selectedWorkspace.workspace_id).eq('status', 'open');
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
            orgId: selectedWorkspace.workspace_id
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
    } catch (error) {
      console.error('Erro ao criar negócio:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar negócio",
        variant: "destructive"
      });
    }
  };
  if (!selectedWorkspace) {
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
          {!isLoading && canManagePipelines(selectedWorkspace?.workspace_id) && <Button onClick={() => setIsCriarPipelineModalOpen(true)} className="bg-primary hover:bg-primary/90">
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
      <main className="min-h-screen flex flex-col w-full">
        
        {/* CARD DE FILTROS */}
        <div className="sticky top-0 z-10 px-2 py-2">
          <div className={cn("flex items-center bg-background border rounded-lg p-3 shadow-sm", isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Settings Button */}
              {canManagePipelines(selectedWorkspace?.workspace_id) && <Button size="icon" variant="ghost" className={cn("h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0", isDarkMode ? "text-orange-400 hover:bg-orange-400/10" : "text-orange-500 hover:bg-orange-500/10")} onClick={() => setIsConfigModalOpen(true)} disabled={!selectedPipeline}>
                  <Settings className="w-5 h-5" />
                </Button>}
              
              {/* Pipeline Select */}
              <div className="min-w-[200px] mr-2 flex-shrink-0">
                {isLoading ? <Skeleton className="h-10 w-full" /> : <Select value={selectedPipeline?.id || ""} onValueChange={value => {
                const pipeline = pipelines.find(p => p.id === value);
                if (pipeline) {
                  selectPipeline(pipeline);
                  // Limpar filtros ao mudar de pipeline
                  setAppliedFilters(null);
                  setSearchTerm("");
                }
              }}>
                    <SelectTrigger className={cn("h-10 border-gray-300 focus:border-primary focus:ring-primary", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                      <SelectValue placeholder="Selecione um pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map(pipeline => <SelectItem key={pipeline.id} value={pipeline.id}>
                          <span className="font-bold">{pipeline.name}</span>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>}
              </div>
              
              {/* Plus Button */}
              {canManagePipelines(selectedWorkspace?.workspace_id) && <Button size="icon" variant="ghost" className={cn("h-10 w-10 text-primary hover:bg-primary/10 flex-shrink-0", isDarkMode ? "text-orange-400 hover:bg-orange-400/10" : "text-orange-500 hover:bg-orange-500/10")} onClick={() => setIsCriarPipelineModalOpen(true)}>
                  <Plus className="w-5 h-5" />
                </Button>}

              {/* Indicador de Realtime */}
              {selectedPipeline && <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Conectado em tempo real</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mudanças aparecerão instantaneamente para todos
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>}

              {/* Filtrar Button */}
              <div className="relative flex-shrink-0">
                <Button size="sm" className={cn("font-medium relative", appliedFilters?.tags && appliedFilters.tags.length > 0 || appliedFilters?.selectedDate || appliedFilters?.dateRange ? "bg-orange-500 text-white hover:bg-orange-600" : isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500")} onClick={() => setIsFilterModalOpen(true)} disabled={!selectedPipeline}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrar
                  {(appliedFilters?.tags && appliedFilters.tags.length > 0 || appliedFilters?.selectedDate || appliedFilters?.dateRange) && <Badge className="ml-2 bg-white text-orange-500 text-xs px-1 py-0 h-auto">
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
              <ActiveUsersAvatars users={activeUsers} isLoading={isLoadingActiveUsers} maxVisible={5} className="ml-2 flex-shrink-0" />
            </div>
            
            {/* + Coluna Button - Only show if pipeline exists and user can manage columns */}
            {selectedPipeline && canManageColumns(selectedWorkspace?.workspace_id) && <Button size="sm" className={cn("bg-warning text-black hover:bg-warning/90 font-medium ml-4 flex-shrink-0", isDarkMode ? "bg-yellow-500 text-black hover:bg-yellow-600" : "bg-yellow-400 text-black hover:bg-yellow-500")} onClick={() => setIsAddColumnModalOpen(true)}>
                + Coluna
              </Button>}
          </div>
        </div>

        {/* CONTAINER DO PIPELINE */}
        <div className="flex-1 overflow-x-auto overflow-y-auto px-2">
          {isLoading ? <div className="flex gap-1.5 sm:gap-3 h-full min-w-full">
              {[...Array(4)].map((_, index) => <div key={index} className="w-60 sm:w-68 flex-shrink-0">
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
              {[...Array(3)].map((_, index) => <div key={index} className="w-60 sm:w-68 flex-shrink-0">
                  <div className="bg-card rounded-lg border border-t-4 h-[600px] max-h-[80vh] flex flex-col">
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
                    <div className="w-60 sm:w-72 flex-shrink-0">
                       <div className={cn("bg-card rounded-lg border border-t-4 h-[600px] max-h-[80vh] flex flex-col border-b-2 border-b-yellow-500", `border-t-[${column.color}]`)} style={{
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
                                <div>
                                  {columnCards.length} {columnCards.length === 1 ? 'negócio' : 'negócios'}
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
                                <DropdownMenuItem onClick={() => {
                            setSelectedColumnForAction(column.id);
                            setIsEditarColunaModalOpen(true);
                          }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar coluna
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                            setSelectedColumnForAction(column.id);
                            setIsSelectionMode(true);
                            setSelectedCardsForTransfer(new Set());
                          }}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Transferir negócios
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                            // Exportar CSV da coluna
                            const columnCards = getCardsByColumn(column.id);
                            const csvData = columnCards.map(card => ({
                              'Título': card.title,
                              'Valor': card.value || 0,
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

      <CriarNegocioModal isOpen={isCriarNegocioModalOpen} onClose={() => setIsCriarNegocioModalOpen(false)} onCreateBusiness={handleCreateBusiness} isDarkMode={isDarkMode} columns={columns} onResponsibleUpdated={() => {
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