import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
}

interface AutomationTrigger {
  id: string;
  automation_id: string;
  trigger_type: 'enter_column' | 'leave_column' | 'time_in_column' | 'message_received';
  trigger_config: any;
}

interface AutomationAction {
  id: string;
  automation_id: string;
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

      // ✅ OTIMIZADO: Buscar apenas contagens de triggers e actions (mais rápido)
      // Não precisa dos dados completos para a lista
      const automationsWithCounts = await Promise.all(
        automationsData.map(async (automation) => {
          const { count: triggersCount } = await supabase
            .from('crm_column_automation_triggers')
            .select('*', { count: 'exact', head: true })
            .eq('automation_id', automation.id);

          const { count: actionsCount } = await supabase
            .from('crm_column_automation_actions')
            .select('*', { count: 'exact', head: true })
            .eq('automation_id', automation.id);

          return {
            ...automation,
            triggersCount: triggersCount || 0,
            actionsCount: actionsCount || 0
          };
        })
      );

      setAutomations(automationsWithCounts as any);
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Automações desta coluna</h3>
          <p className="text-sm text-muted-foreground">
            Configure automações que disparam ações quando cards entram, saem ou ficam nesta coluna
          </p>
        </div>
        <Button onClick={handleNewAutomation}>
          <Plus className="w-4 h-4 mr-2" />
          Nova automação
        </Button>
      </div>

      {automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma automação configurada ainda.
              <br />
              Clique em "Nova automação" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{automation.name}</CardTitle>
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={() => handleToggleActive(automation)}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {automation.is_active ? 'Ativa' : 'Inativa'}
                      </Label>
                    </div>
                    {automation.description && (
                      <CardDescription className="mt-1">{automation.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAutomation(automation)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(automation.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <strong>Gatilhos:</strong> {(automation as any).triggersCount || automation.triggers?.length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Ações:</strong> {(automation as any).actionsCount || automation.actions?.length || 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

