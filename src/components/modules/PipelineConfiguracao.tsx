import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2, ChevronDown, Menu, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DeletarColunaModal } from "@/components/modals/DeletarColunaModal";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
interface PipelineConfigProps {
  isDarkMode?: boolean;
  onColumnsReorder?: (newOrder: any[]) => void;
}
interface SortableColumnProps {
  column: any;
  isDarkMode: boolean;
  onDelete: (column: { id: string; name: string }) => void;
  onUpdatePermissions: (columnId: string, userIds: string[]) => void;
  onUpdateViewAllDealsPermissions: (columnId: string, userIds: string[]) => void;
  onUpdateColumnName: (columnId: string, newName: string) => void;
  isLoading?: boolean;
}
interface Action {
  id: string;
  actionName: string;
  nextPipeline: string;
  targetColumn: string;
  dealState: string;
  buttonColor?: string;
}

// Inicializar apenas com uma ação vazia
const initialActions: Action[] = [{
  id: `temp-${Date.now()}`,
  actionName: "",
  nextPipeline: "",
  targetColumn: "",
  dealState: ""
}];
function SortableColumn({
  column,
  isDarkMode,
  onDelete,
  onUpdatePermissions,
  onUpdateViewAllDealsPermissions,
  onUpdateColumnName,
  isLoading = false
}: SortableColumnProps) {
  const {
    getCardsByColumn
  } = usePipelinesContext();
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    members
  } = useWorkspaceMembers(selectedWorkspace?.workspace_id);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(column.permissions || []);
  const [viewAllDealsUsers, setViewAllDealsUsers] = useState<string[]>(column.view_all_deals_permissions || []);
  const [isEditingName, setIsEditingName] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // Calcular estatísticas da coluna baseado nos cards
  const columnCards = getCardsByColumn(column.id);
  const totalValue = columnCards.reduce((sum, card) => sum + (card.value || 0), 0);
  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(totalValue);

  const handleSaveColumnName = () => {
    if (columnName.trim() && columnName !== column.name) {
      onUpdateColumnName(column.id, columnName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setColumnName(column.name);
    setIsEditingName(false);
  };

  if (isLoading) {
    return (
      <div ref={setNodeRef} style={style} className="grid-item">
        <div className="bg-white rounded-lg shadow-md p-4 relative flex flex-col overflow-hidden border-t-4 border-gray-300">
          {/* Header skeleton */}
          <div className="flex items-start justify-between mb-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
            </div>
          </div>

          {/* Statistics skeleton */}
          <div className="flex justify-between items-center mb-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Users section skeleton */}
          <Skeleton className="h-3 w-40 mt-2 mb-1" />
          <div className="flex items-center mt-1 mb-1">
            <Skeleton className="h-3 w-3 mr-2" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-6 ml-2" />
          </div>

          <Skeleton className="h-3 w-48 mt-1 mb-1" />
          <div className="flex items-center mt-1 mb-2">
            <Skeleton className="h-3 w-3 mr-2" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-6 ml-2" />
          </div>
        </div>
      </div>
    );
  }
  return <div ref={setNodeRef} style={style} className="grid-item">
      <div className="bg-white rounded-lg shadow-md p-4 relative flex flex-col overflow-hidden" style={{
      borderTop: `4px solid ${column.color}`
    }}>
         {/* Header com nome e botões */}
         <div className="flex items-start justify-between mb-2">
           {isEditingName ? (
             <div className="flex-1 mr-2">
               <Input
                 value={columnName}
                 onChange={(e) => setColumnName(e.target.value)}
                 className="text-xs h-6 px-2"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     handleSaveColumnName();
                   }
                   if (e.key === 'Escape') {
                     handleCancelEdit();
                   }
                 }}
                 autoFocus
               />
               <Button
                 size="sm"
                 className="mt-2 h-6 text-xs bg-yellow-500 hover:bg-yellow-600 text-black"
                 onClick={handleSaveColumnName}
               >
                 salvar
               </Button>
             </div>
           ) : (
             <p className="text-xs font-bold w-30 overflow-hidden text-ellipsis whitespace-nowrap">
               {column.name}
             </p>
           )}
           <div className="flex items-center">
             <Button 
               variant="ghost" 
               size="sm" 
               className="h-6 w-6 p-0 mr-1.5" 
               onClick={() => {
                 if (isEditingName) {
                   handleCancelEdit();
                 } else {
                   setIsEditingName(true);
                 }
               }}
             >
               <Pencil className="h-3 w-3" />
             </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1.5" onClick={() => onDelete({ id: column.id, name: column.name })}>
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button className="h-6 w-6 p-0" variant="ghost" size="sm" {...attributes} {...listeners}>
              <Menu className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-xs text-gray-500">{columnCards.length} negócios</p>
            <p className="text-xs text-gray-500">{formattedTotal}</p>
          </div>
          <div></div>
        </div>

        {/* Usuários que podem ver a coluna */}
        <p className="text-xs text-gray-500 mt-2">Usuarios que podem ver a coluna</p>
        <div className="flex items-center mt-1 mb-1">
          <Users className="h-3 w-3 mr-2 text-gray-400" />
          <span className="text-xs text-gray-500">
            {selectedUsers.length === 0 ? 'Todos podem ver' : `${selectedUsers.length} usuário${selectedUsers.length > 1 ? 's' : ''}`}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Selecionar Usuários</h4>
                <div className="flex flex-wrap gap-2">
                  {members?.filter(member => !member.is_hidden).map(member => <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox id={`user-${member.id}`} checked={selectedUsers.includes(member.user_id)} onCheckedChange={checked => {
                    if (checked) {
                      setSelectedUsers([...selectedUsers, member.user_id]);
                    } else {
                      setSelectedUsers(selectedUsers.filter(id => id !== member.user_id));
                    }
                  }} />
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <label htmlFor={`user-${member.id}`} className="text-sm font-medium cursor-pointer">
                          {member.user?.name}
                        </label>
                      </div>
                    </div>)}
                </div>
                <Button className="w-full" onClick={() => {
                onUpdatePermissions(column.id, selectedUsers);
              }}>
                  Salvar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Usuários que podem ver todos os negócios */}
        <p className="text-xs text-gray-500 mt-1">Usuarios que podem ver todos os negócios</p>
        <div className="flex items-center mt-1 mb-2">
          <Users className="h-3 w-3 mr-2 text-gray-400" />
          <span className="text-xs text-gray-500">{viewAllDealsUsers.length} usuário{viewAllDealsUsers.length !== 1 ? 's' : ''}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Usuários que veem todos os negócios</h4>
                <p className="text-sm text-muted-foreground">
                  Usuários selecionados verão todos os negócios desta coluna
                </p>
                <div className="flex flex-wrap gap-2">
                  {members?.filter(member => !member.is_hidden).map(member => <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox id={`view-all-${member.id}`} checked={viewAllDealsUsers.includes(member.user_id)} onCheckedChange={checked => {
                    if (checked) {
                      setViewAllDealsUsers([...viewAllDealsUsers, member.user_id]);
                    } else {
                      setViewAllDealsUsers(viewAllDealsUsers.filter(id => id !== member.user_id));
                    }
                  }} />
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <label htmlFor={`view-all-${member.id}`} className="text-sm font-medium cursor-pointer">
                          {member.user?.name}
                        </label>
                      </div>
                    </div>)}
                </div>
                <Button className="w-full" onClick={() => {
                onUpdateViewAllDealsPermissions(column.id, viewAllDealsUsers);
              }}>
                  Salvar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>;
}
export default function PipelineConfiguracao({
  isDarkMode,
  onColumnsReorder
}: PipelineConfigProps) {
  const [activeTab, setActiveTab] = useState('geral');
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [actionColumns, setActionColumns] = useState<{[key: string]: any[]}>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const {
    columns,
    selectedPipeline,
    reorderColumns,
    pipelines,
    isLoadingColumns: contextIsLoadingColumns,
    selectPipeline,
    refreshCurrentPipeline
  } = usePipelinesContext();
  const {
    user
  } = useAuth();
  const {
    selectedWorkspace
  } = useWorkspace();
  const { toast } = useToast();
  const [pipelineName, setPipelineName] = useState(selectedPipeline?.name || "Vendas");
  const [pipelineType, setPipelineType] = useState(selectedPipeline?.type || "padrao");
  const [currency, setCurrency] = useState("brl");
  const [selectedColumn, setSelectedColumn] = useState("qualificar");
  const [selectedAutomation, setSelectedAutomation] = useState("");
  const handleUpdateColumnPermissions = async (columnId: string, userIds: string[]) => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        },
        body: {
          permissions: userIds
        }
      });
      if (error) throw error;
      console.log('Column permissions updated successfully:', {
        columnId,
        userIds
      });

      // Atualizar o estado local das colunas se necessário
      // (Pode ser implementado posteriormente se precisar)
    } catch (error) {
      console.error('Error updating column permissions:', error);
    }
  };

  const handleUpdateViewAllDealsPermissions = async (columnId: string, userIds: string[]) => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        },
        body: {
          view_all_deals_permissions: userIds
        }
      });
      if (error) throw error;
      console.log('View all deals permissions updated successfully:', {
        columnId,
        userIds
      });

      toast({
        title: "Sucesso",
        description: "Permissões de visualização de negócios atualizadas",
      });
    } catch (error) {
      console.error('Error updating view all deals permissions:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar permissões de visualização de negócios",
        variant: "destructive",
      });
    }
  };
  const handleDeleteColumn = (column: { id: string; name: string }) => {
    setColumnToDelete(column);
    setIsDeleteModalOpen(true);
  };

  const handleUpdateColumnName = async (columnId: string, newName: string) => {
    try {
      // Set local loading state for this specific column
      setIsLoadingColumns(true);
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        },
        body: {
          name: newName
        }
      });

      if (error) throw error;

      console.log('✅ Column name updated successfully');
      
      // Update the local columns state immediately to avoid flickering
      if (selectedPipeline) {
        // Use refreshCurrentPipeline instead of selectPipeline to avoid clearing state
        await refreshCurrentPipeline();
      }

      toast({
        title: "Sucesso",
        description: "Nome da coluna atualizado com sucesso.",
      });
      
    } catch (error: any) {
      console.error('❌ Error updating column name:', error);
      toast({
        title: "Erro ao atualizar nome",
        description: "Ocorreu um erro ao tentar atualizar o nome da coluna. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const deleteColumn = async (columnId: string) => {
    try {
      console.log('🗑️ Deleting column:', columnId);
      
      // Mostrar loading state
      setIsLoadingColumns(true);
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'DELETE',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });

      if (error) throw error;

      console.log('✅ Column deleted successfully');
      
      toast({
        title: "Sucesso",
        description: "Coluna excluída com sucesso",
      });

      // O realtime já vai atualizar automaticamente, mas forçar refresh para garantir
      await refreshCurrentPipeline();
      
    } catch (error: any) {
      console.error('❌ Error deleting column:', error);
      
      // Show user-friendly error message
      if (error.message?.includes('existing cards')) {
        toast({
          title: "Erro ao excluir coluna",
          description: "Não é possível excluir uma coluna que contém cards. Mova os cards para outra coluna primeiro.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao excluir coluna",
          description: "Ocorreu um erro ao tentar excluir a coluna. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingColumns(false);
    }
  };
  // Carregar ações salvas quando selecionar um pipeline
  useEffect(() => {
    if (selectedPipeline?.id) {
      loadPipelineActions(selectedPipeline.id);
    }
  }, [selectedPipeline?.id]);

  const loadPipelineActions = async (pipelineId: string) => {
    try {
      const { data, error } = await supabase
        .from('pipeline_actions')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('order_position');

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedActions: Action[] = data.map(action => ({
          id: action.id,
          actionName: action.action_name,
          nextPipeline: action.target_pipeline_id,
          targetColumn: action.target_column_id,
          dealState: action.deal_state
        }));
        setActions(formattedActions);

        // Carregar colunas para cada ação que já tem pipeline selecionado
        for (const action of formattedActions) {
          if (action.nextPipeline) {
            const columns = await fetchPipelineColumns(action.nextPipeline);
            setActionColumns(prev => ({
              ...prev,
              [action.id]: columns
            }));
          }
        }
      } else {
        setActions(initialActions);
      }
    } catch (error) {
      console.error('Error loading pipeline actions:', error);
      setActions(initialActions);
    }
  };

  const addNewAction = () => {
    const newAction: Action = {
      id: `temp-${Date.now()}`,
      actionName: "",
      nextPipeline: "",
      targetColumn: "",
      dealState: ""
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (id: string, field: keyof Action, value: string) => {
    console.log('🔄 updateAction chamado:', { id, field, value });
    setActions(prevActions => {
      const newActions = prevActions.map(action => action.id === id ? {
        ...action,
        [field]: value
      } : action);
      console.log('✅ Novo estado actions:', newActions);
      return newActions;
    });
  };

  const saveAction = async (action: Action) => {
    console.log('💾 saveAction chamado com:', action);
    console.log('📊 Pipeline selecionado:', selectedPipeline);
    
    if (!selectedPipeline?.id) {
      console.error('❌ Nenhum pipeline selecionado!');
      return;
    }
    
    if (!action.actionName || !action.nextPipeline || !action.targetColumn || !action.dealState) {
      console.log('❌ Campos faltando:', {
        actionName: action.actionName,
        nextPipeline: action.nextPipeline,
        targetColumn: action.targetColumn,
        dealState: action.dealState
      });
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const actionData = {
        pipeline_id: selectedPipeline.id,
        action_name: action.actionName,
        target_pipeline_id: action.nextPipeline,
        target_column_id: action.targetColumn,
        deal_state: action.dealState,
        order_position: actions.indexOf(action)
      };
      
      console.log('📤 Dados que serão enviados:', actionData);

      if (action.id.startsWith('temp-')) {
        // Criar nova ação
        const { data, error } = await supabase
          .from('pipeline_actions')
          .insert(actionData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Ação salva",
          description: "A ação foi criada com sucesso.",
        });
        
        // Recarregar todas as ações do banco
        await loadPipelineActions(selectedPipeline.id);
      } else {
        // Atualizar ação existente
        const { error } = await supabase
          .from('pipeline_actions')
          .update(actionData)
          .eq('id', action.id);

        if (error) throw error;

        toast({
          title: "Ação atualizada",
          description: "A ação foi atualizada com sucesso.",
        });
        
        // Recarregar todas as ações do banco
        await loadPipelineActions(selectedPipeline.id);
      }
    } catch (error) {
      console.error('Error saving action:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a ação.",
        variant: "destructive",
      });
    }
  };

  const deleteAction = async (actionId: string) => {
    try {
      if (!actionId.startsWith('temp-')) {
        const { error } = await supabase
          .from('pipeline_actions')
          .delete()
          .eq('id', actionId);

        if (error) throw error;
      }

      setActions(prev => prev.filter(a => a.id !== actionId));
      
      toast({
        title: "Ação removida",
        description: "A ação foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting action:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a ação.",
        variant: "destructive",
      });
    }
  };

  // Buscar colunas do pipeline selecionado
  const fetchPipelineColumns = async (pipelineId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pipeline columns:', error);
      return [];
    }
  };

  // Quando um pipeline for selecionado, buscar suas colunas
  const handlePipelineChange = async (actionId: string, pipelineId: string) => {
    console.log('🎯 handlePipelineChange chamado:', { actionId, pipelineId });
    console.log('📊 Estado actions antes:', actions);
    
    updateAction(actionId, 'nextPipeline', pipelineId);
    updateAction(actionId, 'targetColumn', ''); // Reset coluna selecionada
    
    console.log('📊 Estado actions depois updateAction:', actions);
    
    const columns = await fetchPipelineColumns(pipelineId);
    console.log('📋 Colunas carregadas:', columns);
    
    setActionColumns(prev => ({
      ...prev,
      [actionId]: columns
    }));
  };
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));
  const handleDragEnd = async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    if (active.id !== over?.id) {
      const oldIndex = columns.findIndex(col => col.id === active.id);
      const newIndex = columns.findIndex(col => col.id === over?.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        // Reorganizar as colunas localmente
        const newColumns = [...columns];
        const [reorderedColumn] = newColumns.splice(oldIndex, 1);
        newColumns.splice(newIndex, 0, reorderedColumn);

        // Atualizar as posições no backend
        const updates = newColumns.map((col, index) => ({
          id: col.id,
          order_position: index
        }));
      try {
        for (const update of updates) {
          await supabase.functions.invoke(`pipeline-management/columns?id=${update.id}`, {
            method: 'PUT',
            headers: {
              'x-system-user-id': user?.id || '',
              'x-system-user-email': user?.email || '',
              'x-workspace-id': selectedWorkspace?.workspace_id || ''
            },
            body: {
              order_position: update.order_position
            }
          });
        }
        console.log('✅ Colunas reordenadas com sucesso');

        // Usar a função do contexto para sincronizar
        if (reorderColumns) {
          await reorderColumns(newColumns);
        }

        // Notificar o componente pai sobre a mudança
        if (onColumnsReorder) {
          onColumnsReorder(newColumns);
        }
      } catch (error) {
        console.error('❌ Erro ao reordenar colunas:', error);
        toast({
          title: "Erro",
          description: "Não foi possível reordenar as colunas",
          variant: "destructive",
        });
      }
      }
    }
  };
  return <div className={cn("min-h-screen", isDarkMode ? "bg-[#1a1a1a]" : "bg-gray-50")}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral">Configurações Gerais</TabsTrigger>
          <TabsTrigger value="colunas">Colunas</TabsTrigger>
          <TabsTrigger value="acoes">Ações</TabsTrigger>
          
        </TabsList>

        {/* Configurações Gerais Tab */}
        <TabsContent value="geral" className="space-y-4">
          <Card className={cn("border-gray-200", isDarkMode && "bg-[#2a2a2a] border-gray-700")}>
            <CardHeader>
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Configurações Gerais do Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Nome do Pipeline
                </label>
                <Input value={pipelineName} onChange={e => setPipelineName(e.target.value)} className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""} />
              </div>
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Tipo do Pipeline
                </label>
                <Select value={pipelineType} onValueChange={setPipelineType}>
                  <SelectTrigger className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colunas Tab */}
        <TabsContent value="colunas" className="space-y-4">
          {(contextIsLoadingColumns || isLoadingColumns) ? (
            // Skeleton loading para colunas
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(3)].map((_, index) => (
                <SortableColumn
                  key={`skeleton-${index}`}
                  column={{ id: `skeleton-${index}`, name: '', color: '#gray' }}
                  isDarkMode={isDarkMode}
                   onDelete={() => {}}
                   onUpdatePermissions={() => {}}
                   onUpdateViewAllDealsPermissions={() => {}}
                   onUpdateColumnName={() => {}}
                   isLoading={true}
                />
              ))}
            </div>
          ) : columns.length === 0 ? (
            // Estado vazio - pipeline novo
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-gray-400 mb-4">
                <Menu className="h-12 w-12 mx-auto" />
              </div>
              <h3 className={cn("text-lg font-medium mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
                Nenhuma coluna encontrada
              </h3>
              <p className={cn("text-sm mb-4", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                Este pipeline ainda não possui colunas configuradas.
              </p>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Coluna
              </Button>
            </div>
          ) : (
            // Estado normal - pipeline com colunas
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={columns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {columns.map(column => (
                    <SortableColumn 
                      key={column.id} 
                      column={column} 
                      isDarkMode={isDarkMode} 
                       onDelete={handleDeleteColumn}
                       onUpdatePermissions={handleUpdateColumnPermissions}
                       onUpdateViewAllDealsPermissions={handleUpdateViewAllDealsPermissions}
                       onUpdateColumnName={handleUpdateColumnName}
                      isLoading={false}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>

        {/* Ações Tab */}
        <TabsContent value="acoes" className="space-y-4">
          <Card className={cn("border-gray-200", isDarkMode && "bg-[#2a2a2a] border-gray-700")}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Ações do Pipeline
              </CardTitle>
              <Button onClick={addNewAction} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Ação
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", isDarkMode ? "border-gray-600" : "border-gray-200")}>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Nome da Ação
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Próximo Pipeline
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Coluna de Destino
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Estado do Negócio
                      </th>
                      <th className={cn("text-left p-2 text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map(action => <tr key={action.id} className={cn("border-b", isDarkMode ? "border-gray-700" : "border-gray-100")}>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={action.buttonColor || '#3b82f6'}
                              onChange={(e) => updateAction(action.id, 'buttonColor', e.target.value)}
                              className="w-10 h-10 rounded border border-border cursor-pointer"
                              title="Escolher cor do botão"
                            />
                            <div className="relative flex-1">
                              <Input 
                                value={action.actionName} 
                                onChange={e => updateAction(action.id, 'actionName', e.target.value)} 
                                placeholder=" "
                                id={`action-name-${action.id}`}
                                className={cn("text-sm peer", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")} 
                              />
                              <label 
                                htmlFor={`action-name-${action.id}`}
                                className={cn(
                                  "absolute left-3 transition-all duration-200 pointer-events-none",
                                  "peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-sm peer-placeholder-shown:bg-transparent",
                                  "peer-focus:-top-2.5 peer-focus:text-xs peer-focus:px-1",
                                  action.actionName ? "-top-2.5 text-xs px-1" : "top-2.5 text-sm",
                                  isDarkMode 
                                    ? "text-gray-400 peer-focus:text-gray-300 peer-focus:bg-[#3a3a3a] bg-[#3a3a3a]" 
                                    : "text-gray-500 peer-focus:text-gray-700 peer-focus:bg-white bg-white"
                                )}
                              >
                                Nome da Ação
                              </label>
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Select value={action.nextPipeline} onValueChange={(value) => handlePipelineChange(action.id, value)}>
                              <SelectTrigger id={`pipeline-${action.id}`} className={cn("text-sm peer", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")}>
                                <SelectValue placeholder=" " />
                              </SelectTrigger>
                              <SelectContent>
                                {pipelines?.map(pipeline => (
                                  <SelectItem key={pipeline.id} value={pipeline.id}>
                                    {pipeline.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label 
                              htmlFor={`pipeline-${action.id}`}
                              className={cn(
                                "absolute left-3 transition-all duration-200 pointer-events-none",
                                action.nextPipeline ? "-top-2.5 text-xs px-1" : "top-2.5 text-sm",
                                isDarkMode 
                                  ? "text-gray-400 bg-[#3a3a3a]" 
                                  : "text-gray-500 bg-white"
                              )}
                            >
                              Próximo Pipeline
                            </label>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Select 
                              value={action.targetColumn} 
                              onValueChange={(value) => updateAction(action.id, 'targetColumn', value)}
                              disabled={!action.nextPipeline}
                            >
                              <SelectTrigger id={`column-${action.id}`} className={cn("text-sm peer", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")}>
                                <SelectValue placeholder=" " />
                              </SelectTrigger>
                              <SelectContent>
                                {(actionColumns[action.id] || []).map((column: any) => (
                                  <SelectItem key={column.id} value={column.id}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label 
                              htmlFor={`column-${action.id}`}
                              className={cn(
                                "absolute left-3 transition-all duration-200 pointer-events-none",
                                action.targetColumn ? "-top-2.5 text-xs px-1" : "top-2.5 text-sm",
                                isDarkMode 
                                  ? "text-gray-400 bg-[#3a3a3a]" 
                                  : "text-gray-500 bg-white"
                              )}
                            >
                              Coluna de Destino
                            </label>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Select value={action.dealState} onValueChange={value => updateAction(action.id, 'dealState', value)}>
                              <SelectTrigger id={`state-${action.id}`} className={cn("text-sm peer", isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : "")}>
                                <SelectValue placeholder=" " />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Ganho">Ganho</SelectItem>
                                <SelectItem value="Perda">Perda</SelectItem>
                              </SelectContent>
                            </Select>
                            <label 
                              htmlFor={`state-${action.id}`}
                              className={cn(
                                "absolute left-3 transition-all duration-200 pointer-events-none",
                                action.dealState ? "-top-2.5 text-xs px-1" : "top-2.5 text-sm",
                                isDarkMode 
                                  ? "text-gray-400 bg-[#3a3a3a]" 
                                  : "text-gray-500 bg-white"
                              )}
                            >
                              Estado do Negócio
                            </label>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => saveAction(action)}
                              disabled={!action.actionName || !action.nextPipeline || !action.targetColumn || !action.dealState}
                            >
                              Salvar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => deleteAction(action.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execuções de Automações Tab */}
        <TabsContent value="execucoes" className="space-y-4">
          <Card className={cn("border-gray-200", isDarkMode && "bg-[#2a2a2a] border-gray-700")}>
            <CardHeader>
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Execuções de Automações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Selecionar Coluna
                  </label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qualificar">Qualificar</SelectItem>
                      <SelectItem value="proposta">Proposta</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Selecionar Automação
                  </label>
                  <Select value={selectedAutomation} onValueChange={setSelectedAutomation}>
                    <SelectTrigger className={isDarkMode ? "bg-[#3a3a3a] border-gray-600 text-white" : ""}>
                      <SelectValue placeholder="Selecione uma automação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto1">Envio de Email</SelectItem>
                      <SelectItem value="auto2">Notificação Slack</SelectItem>
                      <SelectItem value="auto3">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="text-center py-8">
                <div className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  Não há registros de execução para esta automação.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de confirmação para deletar coluna */}
      <DeletarColunaModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setColumnToDelete(null);
        }}
        onConfirm={() => {
          if (columnToDelete) {
            deleteColumn(columnToDelete.id);
          }
        }}
        columnName={columnToDelete?.name || ''}
        isDarkMode={isDarkMode}
      />
    </div>;
}