import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AutomationModal } from './AutomationModal';

interface ColumnAutomation {
  id: string;
  column_id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  triggers?: AutomationTrigger[];
  actions?: AutomationAction[];
  triggersCount?: number;
  actionsCount?: number;
  executionsCount?: number;
}

interface AutomationTrigger {
  id: string;
  automation_id?: string;
  trigger_type: 'enter_column' | 'leave_column' | 'time_in_column' | 'message_received';
  trigger_config: any;
}

interface AutomationAction {
  id: string;
  automation_id?: string;
  action_type: 'send_message' | 'send_funnel' | 'move_to_column' | 'add_tag' | 'add_agent' | 'remove_agent';
  action_config: any;
  action_order: number;
}

interface ColumnAutomationsTabProps {
  columnId: string;
  onAutomationChange?: () => void;
  isActive?: boolean; // ✅ NOVO: Indica se a aba está ativa
  isModalOpen?: boolean; // ✅ NOVO: Indica se o modal está aberto
}

const TIME_UNIT_LABELS: Record<string, string> = {
  minutes: "minutos",
  hours: "horas",
  days: "dias",
};

const truncateText = (value: string, limit = 40) => {
  if (!value) {
    return "";
  }
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
};

const formatTriggerLabel = (trigger: AutomationTrigger) => {
  const config = trigger.trigger_config || {};

  switch (trigger.trigger_type) {
    case "enter_column":
      return "Entrada no card";
    case "leave_column":
      return "Saída da coluna";
    case "time_in_column": {
      const value = config.time_value;
      const unit = config.time_unit;
      const unitLabel = TIME_UNIT_LABELS[unit] || unit || "tempo";
      return value ? `Tempo na coluna: ${value} ${unitLabel}` : "Tempo na coluna";
    }
    case "message_received": {
      const count = config.message_count;
      return count ? `Recebe ${count} mensagem(ns)` : "Mensagens recebidas";
    }
    default:
      return "Gatilho configurado";
  }
};

const formatActionLabel = (action: AutomationAction) => {
  const config = action.action_config || {};

  switch (action.action_type) {
    case "send_message": {
      const message = typeof config.message === "string" ? config.message : "";
      return message
        ? `Enviar mensagem: "${truncateText(message)}"`
        : "Enviar mensagem";
    }
    case "send_funnel":
      return config.funnel_name
        ? `Enviar funil ${config.funnel_name}`
        : "Enviar funil";
    case "move_to_column":
      return config.column_name
        ? `Mover para ${config.column_name}`
        : "Mover para coluna";
    case "add_tag":
      return config.tag_name
        ? `Adicionar tag ${config.tag_name}`
        : "Adicionar tag";
    case "add_agent":
      return config.agent_name
        ? `Adicionar agente ${config.agent_name}`
        : "Adicionar agente";
    case "remove_agent":
      return config.agent_name
        ? `Remover agente ${config.agent_name}`
        : "Remover agente";
    default:
      return "Ação configurada";
  }
};

export function ColumnAutomationsTab({ 
  columnId, 
  onAutomationChange,
  isActive = false,
  isModalOpen = false
}: ColumnAutomationsTabProps) {
  const [automations, setAutomations] = useState<ColumnAutomation[]>([]);
  const [loading, setLoading] = useState(false); // ✅ ALTERADO: Inicia como false
  const [hasLoaded, setHasLoaded] = useState(false); // ✅ NOVO: Controla se já foi carregado
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<ColumnAutomation | null>(null);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();

  const fetchAutomations = async () => {
    if (!columnId || !selectedWorkspace?.workspace_id) {
      setAutomations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // ✅ OTIMIZADO: Buscar apenas as automações (sem triggers/actions)
      // Triggers e actions só serão carregados quando o usuário editar
      const { data: automationsData, error: automationsError } = await supabase
        .rpc('get_column_automations', { p_column_id: columnId });

      if (automationsError) {
        // Verificar se é erro de tabela/função não existente
        const errorMessage = automationsError.message || String(automationsError);
        const errorCode = automationsError.code || '';
        
        if (
          errorCode === '42P01' || // undefined_table
          errorCode === '42883' || // undefined_function
          errorMessage.toLowerCase().includes('does not exist') ||
          errorMessage.toLowerCase().includes('não existe') ||
          errorMessage.toLowerCase().includes('relation') ||
          errorMessage.toLowerCase().includes('function') ||
          errorMessage.toLowerCase().includes('permission denied')
        ) {
          console.error('❌ Erro ao acessar automações:', {
            code: errorCode,
            message: errorMessage,
            error: automationsError
          });
          
          // Mensagem mais específica baseada no tipo de erro
          let errorDescription = "As tabelas de automações ainda não foram criadas. Por favor, aplique as migrations primeiro.";
          
          if (errorMessage.toLowerCase().includes('function')) {
            errorDescription = "A função de automações não foi criada. Por favor, aplique as migrations do banco de dados.";
          } else if (errorMessage.toLowerCase().includes('permission')) {
            errorDescription = "Você não tem permissão para acessar as automações desta coluna.";
          }
          
          toast({
            title: "Erro ao carregar automações",
            description: errorDescription,
            variant: "destructive",
            duration: 5000,
          });
          
          setAutomations([]);
          setLoading(false);
          setHasLoaded(true); // Marcar como carregado para evitar tentativas repetidas
          return;
        }
        
        // Outros erros
        console.error('❌ Erro ao buscar automações:', automationsError);
        throw automationsError;
      }

      if (!automationsData || automationsData.length === 0) {
        setAutomations([]);
        setLoading(false);
        setHasLoaded(true);
        return;
      }

      const automationsWithDetails = await Promise.all(
        automationsData.map(async (automation) => {
          try {
            const [detailsResponse, executionsResponse] = await Promise.all([
              supabase.rpc('get_automation_details', { p_automation_id: automation.id }),
              supabase
                .from('crm_automation_executions')
                .select('*', { count: 'exact', head: true })
                .eq('automation_id', automation.id)
            ]);

            if ((detailsResponse as any)?.error) {
              throw (detailsResponse as any).error;
            }

            if ((executionsResponse as any)?.error) {
              throw (executionsResponse as any).error;
            }

            const details = ((detailsResponse as any)?.data || {}) as {
              triggers?: AutomationTrigger[];
              actions?: AutomationAction[];
            };

            const triggers = Array.isArray(details.triggers) ? details.triggers : [];
            const actions = Array.isArray(details.actions) ? details.actions : [];
            const sortedActions = [...actions].sort((a, b) => {
              const orderA = a?.action_order ?? 0;
              const orderB = b?.action_order ?? 0;
              return orderA - orderB;
            });

            return {
              ...automation,
              triggers,
              actions: sortedActions,
              triggersCount: triggers.length,
              actionsCount: sortedActions.length,
              executionsCount: (executionsResponse as any)?.count || 0
            };
          } catch (detailsError) {
            console.error('Erro ao carregar detalhes da automação:', detailsError);
            return {
              ...automation,
              triggers: [],
              actions: [],
              triggersCount: 0,
              actionsCount: 0,
              executionsCount: 0
            };
          }
        })
      );

      setAutomations(automationsWithDetails as ColumnAutomation[]);
      setHasLoaded(true);
    } catch (error: any) {
      console.error('Erro ao buscar automações:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar automações",
        variant: "destructive",
      });
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ OTIMIZADO: Carregar apenas quando a aba estiver ativa, modal aberto e não tiver carregado ainda
  useEffect(() => {
    // Só carrega se todas as condições forem verdadeiras:
    // 1. A aba está ativa (isActive === true)
    // 2. O modal está aberto (isModalOpen === true)
    // 3. Tem columnId e workspace válidos
    // 4. Ainda não foi carregado (hasLoaded === false)
    const shouldLoad = isActive && isModalOpen && columnId && selectedWorkspace?.workspace_id && !hasLoaded;
    
    if (shouldLoad) {
      fetchAutomations();
    }
  }, [isActive, isModalOpen, columnId, selectedWorkspace?.workspace_id]);

  // ✅ NOVO: Resetar quando fechar o modal ou quando a aba ficar inativa
  useEffect(() => {
    if (!isModalOpen || !isActive) {
      setHasLoaded(false);
      setAutomations([]);
      setLoading(false);
    }
  }, [isModalOpen, isActive]);

  // ✅ NOVO: Recarregar quando mudar o columnId (apenas se a aba estiver ativa e modal aberto)
  const prevColumnId = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Se columnId mudou (e não é o primeiro carregamento), recarregar apenas se a aba estiver ativa
    const columnIdChanged = prevColumnId.current !== undefined && prevColumnId.current !== columnId;
    
    if (columnIdChanged && columnId && selectedWorkspace?.workspace_id && isActive && isModalOpen) {
      setHasLoaded(false);
      // Pequeno delay para evitar múltiplos carregamentos simultâneos
      const timeoutId = setTimeout(() => {
        // Verificar novamente se ainda está ativo antes de carregar
        if (isActive && isModalOpen && columnId && selectedWorkspace?.workspace_id) {
          fetchAutomations();
        }
      }, 100);
      
      prevColumnId.current = columnId;
      return () => clearTimeout(timeoutId);
    }
    
    // Atualizar o ref sempre para rastrear mudanças
    if (prevColumnId.current !== columnId) {
      prevColumnId.current = columnId;
    }
  }, [columnId, isActive, isModalOpen, selectedWorkspace?.workspace_id]);

  const handleToggleActive = async (automation: ColumnAutomation) => {
    try {
      const headers = getHeaders();
      
      const { data: newStatus, error } = await supabase
        .rpc('toggle_column_automation', { 
          p_automation_id: automation.id,
          p_user_id: headers['x-system-user-id']
        });

      if (error) throw error;

      await fetchAutomations();
      onAutomationChange?.();

      toast({
        title: "Sucesso",
        description: `Automação ${automation.is_active ? 'desativada' : 'ativada'} com sucesso`,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar automação:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar automação",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (automationId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;

    try {
      const headers = getHeaders();
      
      const { error } = await supabase
        .rpc('delete_column_automation', { 
          p_automation_id: automationId,
          p_user_id: headers['x-system-user-id']
        });

      if (error) throw error;

      await fetchAutomations();
      onAutomationChange?.();

      toast({
        title: "Sucesso",
        description: "Automação excluída com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao excluir automação:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir automação",
        variant: "destructive",
      });
    }
  };

  const handleNewAutomation = () => {
    setEditingAutomation(null);
    setAutomationModalOpen(true);
  };

  const handleEditAutomation = async (automation: ColumnAutomation) => {
    // ✅ OTIMIZADO: Carregar triggers e actions apenas quando for editar
    try {
    const { data: automationDetails, error: detailsError } = await supabase
      .rpc('get_automation_details', { p_automation_id: automation.id });

    if (detailsError) {
      console.error('Erro ao buscar detalhes:', detailsError);
      toast({
        title: "Erro",
        description: "Erro ao buscar detalhes da automação",
        variant: "destructive"
      });
      return;
    }

    const details = automationDetails as any;

    setEditingAutomation({
      ...automation,
      triggers: details?.triggers || [],
      actions: details?.actions || []
    });
      setAutomationModalOpen(true);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes da automação:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar automação",
        variant: "destructive",
      });
    }
  };

  const handleAutomationSaved = () => {
    setAutomationModalOpen(false);
    setEditingAutomation(null);
    fetchAutomations();
    onAutomationChange?.();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-gray-50 border border-[#d4d4d4] p-3 rounded-none">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Automações desta coluna</h3>
          <p className="text-xs text-muted-foreground">
            Configure automações que disparam ações quando cards entram, saem ou ficam nesta coluna
          </p>
        </div>
        <Button onClick={handleNewAutomation} className="h-8 text-xs rounded-none bg-primary hover:bg-primary/90">
          <Plus className="w-3.5 h-3.5 mr-2" />
          Nova automação
        </Button>
      </div>

      {automations.length === 0 ? (
        <Card className="border border-[#d4d4d4] rounded-none shadow-none bg-white">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xs text-muted-foreground text-center">
              Nenhuma automação configurada ainda.
              <br />
              Clique em "Nova automação" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {automations.map((automation) => {
            const triggers = automation.triggers ?? [];
            const actions = automation.actions ?? [];
            const triggersCount = automation.triggersCount ?? triggers.length;
            const actionsCount = automation.actionsCount ?? actions.length;
            const executionsCount = automation.executionsCount ?? 0;

            return (
              <Card key={automation.id} className="border border-[#d4d4d4] shadow-sm rounded-none overflow-hidden">
                <CardHeader className="pb-3 bg-[#f0f0f0] border-b border-[#d4d4d4] p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-sm font-bold text-gray-800">{automation.name}</CardTitle>
                      {automation.description && (
                        <CardDescription className="text-xs">{automation.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium ${automation.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}
                      >
                        {automation.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={() => handleToggleActive(automation)}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 p-4">
                  <div className="grid gap-6 md:grid-cols-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <span>Gatilhos</span>
                        <Badge
                          variant="outline"
                          className="rounded-none border-amber-200 bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0"
                        >
                          {triggersCount}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {triggers.length > 0 ? (
                          triggers.map((trigger, index) => (
                            <Badge
                              key={trigger.id || `trigger-${index}`}
                              variant="outline"
                              className="border border-amber-200 bg-amber-50 text-amber-700 rounded-none text-[10px] font-normal"
                            >
                              {formatTriggerLabel(trigger)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            Nenhum gatilho configurado
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <span>Ações</span>
                        <Badge
                          variant="outline"
                          className="rounded-none border-blue-200 bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0"
                        >
                          {actionsCount}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {actions.length > 0 ? (
                          actions.map((action, index) => (
                            <Badge
                              key={action.id || `action-${index}`}
                              variant="outline"
                              className="border border-blue-200 bg-blue-50 text-blue-700 rounded-none text-[10px] font-normal"
                            >
                              {formatActionLabel(action)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            Nenhuma ação configurada
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <span>Execuções</span>
                        <Badge
                          variant="outline"
                          className="rounded-none border-gray-200 bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0"
                        >
                          {executionsCount}
                        </Badge>
                      </div>
                      <div className="mt-1 rounded-none border border-[#d4d4d4] bg-gray-50 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-gray-900">{executionsCount}</div>
                        <div className="text-[10px] text-muted-foreground">total de execuções</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-1 pt-3 border-t border-[#d4d4d4]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditAutomation(automation)}
                      className="h-6 w-6 p-0 rounded-none border-gray-300 hover:bg-gray-100"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(automation.id)}
                      className="h-6 w-6 p-0 rounded-none border-gray-300 hover:bg-red-50 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AutomationModal
        open={automationModalOpen}
        onOpenChange={setAutomationModalOpen}
        columnId={columnId}
        automation={editingAutomation}
        onSaved={handleAutomationSaved}
      />
    </div>
  );
}

