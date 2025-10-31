import React, { useState, useEffect } from 'react';
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
  trigger_type: 'enter_column' | 'leave_column' | 'time_in_column' | 'recurring' | 'message_received';
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
}

export function ColumnAutomationsTab({ columnId, onAutomationChange }: ColumnAutomationsTabProps) {
  const [automations, setAutomations] = useState<ColumnAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<ColumnAutomation | null>(null);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();

  const fetchAutomations = async () => {
    if (!columnId || !selectedWorkspace?.workspace_id) return;

    try {
      setLoading(true);
      
      // ✅ OTIMIZADO: Buscar apenas as automações (sem triggers/actions)
      // Triggers e actions só serão carregados quando o usuário editar
      const { data: automationsData, error: automationsError } = await supabase
        .from('crm_column_automations')
        .select('*')
        .eq('column_id', columnId)
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (automationsError) {
        // Se erro 404 ou "relation does not exist", a tabela não foi criada
        if (automationsError.code === '42P01' || automationsError.message?.includes('does not exist')) {
          console.error('❌ Tabela crm_column_automations não existe. A migration precisa ser aplicada.');
          toast({
            title: "Erro",
            description: "As tabelas de automações ainda não foram criadas. Por favor, aplique a migration primeiro.",
            variant: "destructive",
          });
        }
        throw automationsError;
      }

      if (!automationsData || automationsData.length === 0) {
        setAutomations([]);
        setLoading(false);
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
    } catch (error: any) {
      console.error('Erro ao buscar automações:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar automações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (columnId && selectedWorkspace?.workspace_id) {
      fetchAutomations();
    }
  }, [columnId, selectedWorkspace?.workspace_id]);

  const handleToggleActive = async (automation: ColumnAutomation) => {
    try {
      const headers = getHeaders();
      
      const { error } = await supabase
        .from('crm_column_automations')
        .update({ is_active: !automation.is_active })
        .eq('id', automation.id);

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
        .from('crm_column_automations')
        .delete()
        .eq('id', automationId);

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
      const { data: triggers } = await supabase
        .from('crm_column_automation_triggers')
        .select('*')
        .eq('automation_id', automation.id)
        .order('created_at', { ascending: true });

      const { data: actions } = await supabase
        .from('crm_column_automation_actions')
        .select('*')
        .eq('automation_id', automation.id)
        .order('action_order', { ascending: true });

      setEditingAutomation({
        ...automation,
        triggers: triggers || [],
        actions: actions || []
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

