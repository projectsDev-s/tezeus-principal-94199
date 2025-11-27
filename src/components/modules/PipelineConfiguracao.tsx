import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { DeletarPipelineModal } from "@/components/modals/DeletarPipelineModal";

interface PipelineConfigProps {
  isDarkMode?: boolean;
  onColumnsReorder?: (newOrder: any[]) => void;
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

export default function PipelineConfiguracao({
  isDarkMode,
  onColumnsReorder
}: PipelineConfigProps) {
  const [activeTab, setActiveTab] = useState('geral');
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [actionColumns, setActionColumns] = useState<{[key: string]: any[]}>({});
  const { getHeaders } = useWorkspaceHeaders();
  const [isDeletePipelineModalOpen, setIsDeletePipelineModalOpen] = useState(false);
  const [isDeletingPipeline, setIsDeletingPipeline] = useState(false);
  const {
    columns,
    selectedPipeline,
    reorderColumns,
    pipelines,
    isLoadingColumns: contextIsLoadingColumns,
    selectPipeline,
    refreshCurrentPipeline,
    deletePipeline
  } = usePipelinesContext();
  const {
    user,
    userRole
  } = useAuth();
  const {
    selectedWorkspace
  } = useWorkspace();
  const { toast } = useToast();
  const [pipelineName, setPipelineName] = useState(selectedPipeline?.name || "Vendas");
  const [currency, setCurrency] = useState("brl");
  const [selectedColumn, setSelectedColumn] = useState("qualificar");
  const [selectedAutomation, setSelectedAutomation] = useState("");
  const canConfigureOpenStatus = userRole === 'master' || userRole === 'admin';

  const handleDeletePipeline = async () => {
    if (!selectedPipeline) return;
    
    setIsDeletingPipeline(true);
    
    try {
      await deletePipeline(selectedPipeline.id);
      setIsDeletePipelineModalOpen(false);
      
      toast({
        title: "Pipeline excluído",
        description: "O pipeline foi excluído com sucesso.",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao deletar pipeline:', error);
      toast({
        title: "Erro ao excluir pipeline",
        description: error.message || "Ocorreu um erro ao tentar excluir o pipeline.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPipeline(false);
    }
  };

  const deleteColumn = async (columnId: string) => {
    try {
      console.log('🗑️ Deleting column:', columnId);
      
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
      console.log('📥 Carregando ações para pipeline:', pipelineId);
      
      const headers = getHeaders();
      const { data, error } = await supabase.functions.invoke(
        `pipeline-management/actions?pipeline_id=${pipelineId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (error) {
        console.error('❌ Erro ao carregar ações:', error);
        throw error;
      }

      console.log('📦 Ações carregadas do banco:', data);

      if (data && data.length > 0) {
        const formattedActions: Action[] = data.map(action => ({
          id: action.id,
          actionName: action.action_name,
          nextPipeline: action.target_pipeline_id,
          targetColumn: action.target_column_id,
          dealState: action.deal_state
        }));
        
        console.log('✅ Ações formatadas:', formattedActions);
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
        console.log('⚠️ Nenhuma ação encontrada, usando ações iniciais');
        setActions(initialActions);
      }
    } catch (error) {
      console.error('❌ Error loading pipeline actions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as ações do pipeline.",
        variant: "destructive",
      });
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
    console.log('👤 Usuário:', { id: user?.id, email: user?.email });
    console.log('🏢 Workspace:', selectedWorkspace?.workspace_id);
    
    if (!selectedPipeline?.id) {
      console.error('❌ Nenhum pipeline selecionado!');
      return;
    }

    if (!user?.id || !user?.email) {
      console.error('❌ Usuário não autenticado!');
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar autenticado para salvar ações.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedWorkspace?.workspace_id) {
      console.error('❌ Nenhum workspace selecionado!');
      toast({
        title: "Erro",
        description: "Nenhum workspace selecionado.",
        variant: "destructive",
      });
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
      // Configurar contexto do usuário primeiro
      const { error: contextError } = await supabase.rpc('set_current_user_context', {
        user_id: user.id,
        user_email: user.email
      });

      if (contextError) {
        console.error('❌ Erro ao configurar contexto:', contextError);
        throw new Error('Falha ao configurar contexto do usuário');
      }

      console.log('✅ Contexto do usuário configurado');

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
        const headers = getHeaders();
        const { data, error } = await supabase.functions.invoke(
          'pipeline-management/actions',
          {
            method: 'POST',
            headers,
            body: actionData
          }
        );

        if (error) {
          console.error('❌ Erro ao criar ação:', error);
          throw error;
        }

        console.log('✅ Ação criada com sucesso:', data);

        toast({
          title: "Ação salva",
          description: "A ação foi criada com sucesso.",
        });
        
        // Recarregar todas as ações do banco
        await loadPipelineActions(selectedPipeline.id);
      } else {
        // Atualizar ação existente
        const headers = getHeaders();
        const { error } = await supabase.functions.invoke(
          `pipeline-management/actions?id=${action.id}`,
          {
            method: 'PUT',
            headers,
            body: actionData
          }
        );

        if (error) {
          console.error('❌ Erro ao atualizar ação:', error);
          throw error;
        }

        console.log('✅ Ação atualizada com sucesso');

        toast({
          title: "Ação atualizada",
          description: "A ação foi atualizada com sucesso.",
        });
        
        // Recarregar todas as ações do banco
        await loadPipelineActions(selectedPipeline.id);
      }
    } catch (error: any) {
      console.error('❌ Error saving action:', error);
      toast({
        title: "Erro ao salvar ação",
        description: error.message || "Não foi possível salvar a ação. Verifique suas permissões.",
        variant: "destructive",
      });
    }
  };

  const deleteAction = async (actionId: string) => {
    try {
      if (!actionId.startsWith('temp-')) {
        const headers = getHeaders();
        const { error } = await supabase.functions.invoke(
          `pipeline-management/actions?id=${actionId}`,
          {
            method: 'DELETE',
            headers
          }
        );

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

  return <div className={cn("min-h-screen", isDarkMode ? "bg-background" : "bg-muted/30")}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="geral">Configurações Gerais</TabsTrigger>
          <TabsTrigger value="acoes">Ações</TabsTrigger>
        </TabsList>

        {/* Configurações Gerais Tab */}
        <TabsContent value="geral" className="space-y-4">
          <Card className={cn("border-border", isDarkMode && "bg-card border-border")}>
            <CardHeader>
              <CardTitle className={cn("text-lg", isDarkMode && "text-white")}>
                Configurações Gerais do Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Nome do Pipeline
                </label>
                <div className="flex gap-2">
                  <Input value={pipelineName} onChange={e => setPipelineName(e.target.value)} className={isDarkMode ? "bg-muted border-border text-foreground" : ""} />
                  <Button
                    onClick={async () => {
                      if (!selectedPipeline?.id) return;
                      
                      try {
                        const { error } = await supabase
                          .from('pipelines')
                          .update({
                            name: pipelineName
                          })
                          .eq('id', selectedPipeline.id);
                        
                        if (error) throw error;
                        
                        toast({
                          title: "Sucesso",
                          description: "Pipeline atualizado com sucesso"
                        });
                        
                        // Atualizar contexto
                        if (refreshCurrentPipeline) {
                          await refreshCurrentPipeline();
                        }
                      } catch (error) {
                        console.error('Erro ao atualizar pipeline:', error);
                        toast({
                          title: "Erro",
                          description: "Erro ao atualizar pipeline",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Salvar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!selectedPipeline?.id || !selectedWorkspace?.workspace_id) return;
                      
                      try {
                        const { error } = await supabase.functions.invoke('manage-workspaces', {
                          body: {
                            action: 'update',
                            workspaceId: selectedWorkspace.workspace_id,
                            name: selectedWorkspace.name,
                            defaultPipelineId: selectedPipeline.id
                          },
                          headers: getHeaders()
                        });

                        if (error) throw error;

                        toast({
                          title: "Sucesso",
                          description: "Pipeline definido como padrão com sucesso!",
                        });

                        // Atualizar contexto se necessário
                        if (refreshCurrentPipeline) {
                          await refreshCurrentPipeline();
                        }
                      } catch (error) {
                        console.error('Erro ao definir pipeline padrão:', error);
                        toast({
                          title: "Erro",
                          description: "Erro ao definir pipeline padrão",
                          variant: "destructive"
                        });
                      }
                    }}
                    variant="outline"
                  >
                    Definir como padrão
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Seção de Exclusão - Zona de Perigo */}
          <Card className="border-red-200">
            <CardContent className="bg-red-50 rounded-lg p-6 mt-6">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Zona de Perigo
              </h3>
              <p className="text-xs text-red-700 mb-4">
                Excluir este pipeline removerá permanentemente todas as colunas e negócios associados.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeletePipelineModalOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Pipeline
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ações Tab */}
        <TabsContent value="acoes" className="space-y-4">
          <Card className={cn("border-border", isDarkMode && "bg-card border-border")}>
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
                        Status do Negócio
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
                                className={cn("text-sm peer", isDarkMode ? "bg-muted border-border text-foreground" : "")} 
                              />
                              <label 
                                htmlFor={`action-name-${action.id}`}
                                className={cn(
                                  "absolute left-3 transition-all duration-200 pointer-events-none",
                                  "peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-sm peer-placeholder-shown:bg-transparent",
                                  "peer-focus:-top-2.5 peer-focus:text-xs peer-focus:px-1",
                                  action.actionName ? "-top-2.5 text-xs px-1" : "top-2.5 text-sm",
                                  isDarkMode 
                                    ? "text-muted-foreground peer-focus:text-foreground peer-focus:bg-muted bg-muted" 
                                    : "text-muted-foreground peer-focus:text-foreground peer-focus:bg-background bg-background"
                                )}
                              >
                                Nome da Ação
                              </label>
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <Select value={action.nextPipeline} onValueChange={(value) => handlePipelineChange(action.id, value)}>
                            <SelectTrigger className={cn("text-sm", isDarkMode ? "bg-muted border-border text-foreground" : "")}>
                              <SelectValue placeholder="Próxima pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              {pipelines?.map(pipeline => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select 
                            value={action.targetColumn} 
                            onValueChange={(value) => updateAction(action.id, 'targetColumn', value)}
                            disabled={!action.nextPipeline}
                          >
                            <SelectTrigger className={cn("text-sm", isDarkMode ? "bg-muted border-border text-foreground" : "")}>
                              <SelectValue placeholder="Coluna destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {(actionColumns[action.id] || []).map((column: any) => (
                                <SelectItem key={column.id} value={column.id}>
                                  {column.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={action.dealState} onValueChange={value => updateAction(action.id, 'dealState', value)}>
                            <SelectTrigger className={cn("text-sm", isDarkMode ? "bg-muted border-border text-foreground" : "")}>
                              <SelectValue placeholder="Estado do negócio" />
                            </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Aberto" disabled={!canConfigureOpenStatus}>
                                Aberto {!canConfigureOpenStatus ? '(somente admin/master)' : ''}
                              </SelectItem>
                              <SelectItem value="Ganho">Ganho</SelectItem>
                              <SelectItem value="Perda">Perda</SelectItem>
                            </SelectContent>
                          </Select>
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
          <Card className={cn("border-border", isDarkMode && "bg-card border-border")}>
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
                    <SelectTrigger className={isDarkMode ? "bg-muted border-border text-foreground" : ""}>
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
                    <SelectTrigger className={isDarkMode ? "bg-muted border-border text-foreground" : ""}>
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

      {/* Modal de confirmação para deletar pipeline */}
      <DeletarPipelineModal
        isOpen={isDeletePipelineModalOpen}
        onClose={() => setIsDeletePipelineModalOpen(false)}
        onConfirm={handleDeletePipeline}
        pipelineName={selectedPipeline?.name || ""}
        isDeleting={isDeletingPipeline}
      />
    </div>;
}