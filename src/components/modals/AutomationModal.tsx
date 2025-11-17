import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useWorkspace } from '@/contexts/WorkspaceContext';
// ✅ Removidos hooks que carregam tudo de uma vez - agora fazemos lazy loading

interface AutomationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  automation?: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    triggers?: Array<{
      id: string;
      trigger_type: string;
      trigger_config: any;
    }>;
    actions?: Array<{
      id: string;
      action_type: string;
      action_config: any;
      action_order: number;
    }>;
  } | null;
  onSaved: () => void;
}

interface Trigger {
  id: string;
  trigger_type: 'enter_column' | 'leave_column' | 'time_in_column' | 'recurring' | 'message_received' | '';
  trigger_config: any;
}

interface Action {
  id: string;
  action_type: 'send_message' | 'send_funnel' | 'move_to_column' | 'add_tag' | 'add_agent' | 'remove_agent' | '';
  action_config: any;
  action_order: number;
}

const TRIGGER_TYPES = [
  { value: 'enter_column', label: 'Entrada na coluna' },
  { value: 'leave_column', label: 'Saída da coluna' },
  { value: 'time_in_column', label: 'Tempo na coluna' },
  { value: 'recurring', label: 'Execução recorrente' },
  { value: 'message_received', label: 'Mensagens recebidas' },
];

const ACTION_TYPES = [
  { value: 'send_message', label: 'Enviar mensagem' },
  { value: 'send_funnel', label: 'Enviar funil' },
  { value: 'move_to_column', label: 'Mudar coluna' },
  { value: 'add_tag', label: 'Adicionar tag' },
  { value: 'add_agent', label: 'Adicionar agente de IA' },
  { value: 'remove_agent', label: 'Remover agente de IA' },
];

const CONNECTION_MODES = [
  { value: 'default', label: 'Conexão padrão' },
  { value: 'last', label: 'Última conversa' },
  { value: 'specific', label: 'Conexão específica' },
];

const TIME_UNITS = [
  { value: 'minutes', label: 'minuto(s)' },
  { value: 'hours', label: 'hora(s)' },
  { value: 'days', label: 'dia(s)' },
];

export function AutomationModal({
  open,
  onOpenChange,
  columnId,
  automation,
  onSaved,
}: AutomationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();
  
  // ✅ OTIMIZADO: Estados para dados sob demanda
  const [funnels, setFunnels] = useState<any[]>([]);
  const [funnelsLoading, setFunnelsLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [columns, setColumns] = useState<any[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // ✅ Funções de carregamento lazy
  const loadFunnels = async () => {
    if (funnels.length > 0 || funnelsLoading) return; // Já carregado ou carregando
    
    try {
      setFunnelsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      
      const { data, error } = await supabase
        .from('quick_funnels')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setFunnels(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar funis:', error);
    } finally {
      setFunnelsLoading(false);
    }
  };

  const loadConnections = async () => {
    if (connections.length > 0 || connectionsLoading) return;
    
    try {
      setConnectionsLoading(true);
      if (!selectedWorkspace?.workspace_id) {
        console.log('🔍 Conexões: workspace_id não disponível');
        return;
      }
      
      console.log('🔍 Carregando conexões para workspace:', selectedWorkspace.workspace_id);
      
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('status', 'connected')
        .order('instance_name');
      
      if (error) throw error;
      
      console.log('🔍 Conexões carregadas:', {
        total: data?.length || 0,
        workspaceId: selectedWorkspace.workspace_id,
        conexoes: data?.map(c => ({ id: c.id, nome: c.instance_name, status: c.status }))
      });
      
      setConnections(data || []);
      
      if (!data || data.length === 0) {
        console.warn('⚠️ Nenhuma conexão ativa encontrada para o workspace');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar conexões:', error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const loadTags = async () => {
    if (tags.length > 0 || tagsLoading) return;
    
    try {
      setTagsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      
      if (error) throw error;
      setTags(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar tags:', error);
    } finally {
      setTagsLoading(false);
    }
  };

  const loadColumns = async () => {
    if (columns.length > 0 || columnsLoading) return;
    
    try {
      setColumnsLoading(true);
      
      // Buscar pipeline_id da coluna
      const { data: columnData } = await supabase
        .from('pipeline_columns')
        .select('pipeline_id')
        .eq('id', columnId)
        .single();
      
      if (columnData?.pipeline_id) {
        const { data: cols, error } = await supabase
          .from('pipeline_columns')
          .select('*')
          .eq('pipeline_id', columnData.pipeline_id)
          .order('order_position');
        
        if (error) throw error;
        setColumns(cols || []);
      }
    } catch (error: any) {
      console.error('Erro ao carregar colunas:', error);
    } finally {
      setColumnsLoading(false);
    }
  };

  const loadAgents = async () => {
    if (agents.length > 0 || agentsLoading) return;
    
    try {
      setAgentsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setAgentsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (automation) {
        setName(automation.name || '');
        setDescription(automation.description || '');
        setTriggers(automation.triggers?.map(t => ({
          id: t.id,
          trigger_type: t.trigger_type as any,
          trigger_config: t.trigger_config || {}
        })) || []);
        setActions(automation.actions?.map(a => ({
          id: a.id,
          action_type: a.action_type as any,
          action_config: {
            ...a.action_config || {},
            // ✅ Garantir que remove_current seja booleano se for remove_agent
            ...(a.action_type === 'remove_agent' && !a.action_config?.remove_current && !a.action_config?.agent_id 
              ? { remove_current: true } 
              : {})
          },
          action_order: a.action_order || 0
        })) || []);
        
        // ✅ Carregar dados necessários se a automação já tiver ações configuradas
        const needsFunnels = automation.actions?.some(a => a.action_type === 'send_funnel');
        const needsConnections = automation.actions?.some(a => 
          (a.action_type === 'send_message' || a.action_type === 'send_funnel') &&
          a.action_config?.connection_mode === 'specific'
        );
        const needsTags = automation.actions?.some(a => a.action_type === 'add_tag');
        const needsColumns = automation.actions?.some(a => a.action_type === 'move_to_column');
        const needsAgents = automation.actions?.some(a => 
          a.action_type === 'add_agent' || a.action_type === 'remove_agent'
        );
        
        if (needsFunnels) loadFunnels();
        if (needsConnections) loadConnections();
        if (needsTags) loadTags();
        if (needsColumns) loadColumns();
        if (needsAgents) loadAgents();
      } else {
        setName('');
        setDescription('');
        setTriggers([]);
        setActions([]);
      }
      
      // ✅ Limpar cache quando fecha o modal
      return () => {
        // Manter dados em cache para próximas aberturas
      };
    } else {
      // Limpar apenas quando fecha completamente
    }
  }, [open, automation, columnId]);

  const addTrigger = () => {
    setTriggers([...triggers, {
      id: `temp-${Date.now()}`,
      trigger_type: '',
      trigger_config: {}
    }]);
  };

  const removeTrigger = (id: string) => {
    setTriggers(triggers.filter(t => t.id !== id));
  };

  const updateTrigger = (id: string, field: keyof Trigger, value: any) => {
    setTriggers(triggers.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const updateTriggerConfig = (id: string, configField: string, value: any) => {
    setTriggers(triggers.map(t => 
      t.id === id ? { ...t, trigger_config: { ...t.trigger_config, [configField]: value } } : t
    ));
  };

  const addAction = () => {
    setActions([...actions, {
      id: `temp-${Date.now()}`,
      action_type: '',
      action_config: {},
      action_order: actions.length
    }]);
  };

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  const updateAction = async (id: string, field: keyof Action, value: any) => {
    setActions(actions.map(a => {
      if (a.id === id) {
        const updated = { ...a, [field]: value };
        
        // ✅ Carregar dados sob demanda quando o tipo de ação muda
        if (field === 'action_type' && value) {
          if (value === 'send_funnel') {
            loadFunnels();
          }
          if (value === 'move_to_column') {
            loadColumns();
          }
          if (value === 'add_tag') {
            loadTags();
          }
          if (value === 'add_agent' || value === 'remove_agent') {
            loadAgents();
          }
        }
        
        return updated;
      }
      return a;
    }));
  };

  const updateActionConfig = async (id: string, configKey: string, value: any) => {
    setActions(actions.map(a => {
      if (a.id === id) {
        const updatedConfig = { ...a.action_config };
        
        // Se o valor for null, remover o campo ao invés de definir como null
        if (value === null || value === undefined) {
          delete updatedConfig[configKey];
        } else {
          updatedConfig[configKey] = value;
        }
        
        const updated = {
          ...a,
          action_config: updatedConfig
        };
        
        // ✅ Carregar conexões quando selecionar "conexão específica"
        if (configKey === 'connection_mode' && value === 'specific') {
          loadConnections();
        }
        
        return updated;
      }
      return a;
    }));
  };

  const handleSave = async () => {
    // Validações
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da automação é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (triggers.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um gatilho",
        variant: "destructive",
      });
      return;
    }

    if (actions.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma ação",
        variant: "destructive",
      });
      return;
    }

    // Validar que todos os triggers têm tipo
    const invalidTriggers = triggers.filter(t => !t.trigger_type);
    if (invalidTriggers.length > 0) {
      toast({
        title: "Erro",
        description: "Todos os gatilhos devem ter um tipo selecionado",
        variant: "destructive",
      });
      return;
    }

    // Validar que todas as ações têm tipo
    const invalidActions = actions.filter(a => !a.action_type);
    if (invalidActions.length > 0) {
      toast({
        title: "Erro",
        description: "Todas as ações devem ter um tipo selecionado",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();

      // Configurar contexto do usuário antes das chamadas RPC
      await supabase.rpc('set_current_user_context', {
        user_id: headers['x-system-user-id'],
        user_email: headers['x-system-user-email']
      });

      if (automation?.id) {
        // Atualizar automação existente usando função SQL
        const triggersJson = triggers.map(t => ({
          trigger_type: t.trigger_type,
          trigger_config: t.trigger_config || {}
        }));

        const actionsJson = actions.map(a => ({
          action_type: a.action_type,
          action_config: a.action_config || {}
        }));

        // ✅ Log para debug da ação remove_agent
        const removeAgentActions = actionsJson.filter(a => a.action_type === 'remove_agent');
        if (removeAgentActions.length > 0) {
          console.log('🔍 [AutomationModal] Salvando ações remove_agent (UPDATE):', JSON.stringify(removeAgentActions, null, 2));
        }

        const { error: updateError } = await supabase.rpc('update_column_automation', {
          p_automation_id: automation.id,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_triggers: triggersJson as any,
          p_actions: actionsJson as any,
          p_user_id: headers['x-system-user-id']
        });

        if (updateError) throw updateError;
      } else {
        // Criar nova automação usando função SQL
        if (!selectedWorkspace?.workspace_id) {
          throw new Error('Workspace não selecionado');
        }

        const triggersJson = triggers.map(t => ({
          trigger_type: t.trigger_type,
          trigger_config: t.trigger_config || {}
        }));

        const actionsJson = actions.map(a => ({
          action_type: a.action_type,
          action_config: a.action_config || {}
        }));

        // ✅ Log para debug da ação remove_agent
        const removeAgentActions = actionsJson.filter(a => a.action_type === 'remove_agent');
        if (removeAgentActions.length > 0) {
          console.log('🔍 [AutomationModal] Salvando ações remove_agent:', JSON.stringify(removeAgentActions, null, 2));
        }

        const { data: automationId, error: createError } = await supabase.rpc('create_column_automation', {
          p_column_id: columnId,
          p_workspace_id: selectedWorkspace.workspace_id,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_triggers: triggersJson as any,
          p_actions: actionsJson as any,
          p_user_id: headers['x-system-user-id']
        });

        if (createError) throw createError;
      }

      toast({
        title: "Sucesso",
        description: `Automação ${automation ? 'atualizada' : 'criada'} com sucesso`,
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar automação:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar automação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderActionFields = (action: Action) => {
    switch (action.action_type) {
      case 'send_message':
        return (
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={action.action_config?.message || ''}
              onChange={(e) => updateActionConfig(action.id, 'message', e.target.value)}
              placeholder="Digite a mensagem a ser enviada"
              rows={3}
            />
            <Label>Modo de conexão</Label>
            <Select
              value={action.action_config?.connection_mode || 'default'}
              onValueChange={(value) => updateActionConfig(action.id, 'connection_mode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {action.action_config?.connection_mode === 'specific' && (
              <>
                <Label>Conexão específica</Label>
                <Select
                  value={action.action_config?.connection_id || ''}
                  onValueChange={(value) => updateActionConfig(action.id, 'connection_id', value)}
                  onOpenChange={(open) => {
                    if (open && connections.length === 0 && !connectionsLoading) {
                      loadConnections();
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={connectionsLoading ? "Carregando..." : "Selecione uma conexão"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connectionsLoading ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Carregando conexões...
                      </div>
                    ) : connections.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center space-y-1">
                        <div className="font-medium">Nenhuma conexão ativa encontrada</div>
                        <div className="text-xs">
                          Conecte uma instância do WhatsApp primeiro
                        </div>
                      </div>
                    ) : (
                      connections.map(conn => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.instance_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        );

      case 'send_funnel':
        return (
          <div className="space-y-2">
            <Label>Funil</Label>
            <Select
              value={action.action_config?.funnel_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, 'funnel_id', value)}
              onOpenChange={(open) => {
                if (open && funnels.length === 0 && !funnelsLoading) {
                  loadFunnels();
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={funnelsLoading ? "Carregando..." : "Selecione um funil"} />
              </SelectTrigger>
              <SelectContent>
                {funnelsLoading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Carregando funis...
                  </div>
                ) : funnels.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum funil encontrado
                  </div>
                ) : (
                  funnels.map(funnel => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Label>Modo de conexão</Label>
            <Select
              value={action.action_config?.connection_mode || 'default'}
              onValueChange={(value) => updateActionConfig(action.id, 'connection_mode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {action.action_config?.connection_mode === 'specific' && (
              <>
                <Label>Conexão específica</Label>
                <Select
                  value={action.action_config?.connection_id || ''}
                  onValueChange={(value) => updateActionConfig(action.id, 'connection_id', value)}
                  onOpenChange={(open) => {
                    if (open && connections.length === 0 && !connectionsLoading) {
                      loadConnections();
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={connectionsLoading ? "Carregando..." : "Selecione uma conexão"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connectionsLoading ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Carregando conexões...
                      </div>
                    ) : connections.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center space-y-1">
                        <div className="font-medium">Nenhuma conexão ativa encontrada</div>
                        <div className="text-xs">
                          Conecte uma instância do WhatsApp primeiro
                        </div>
                      </div>
                    ) : (
                      connections.map(conn => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.instance_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        );

      case 'move_to_column':
        return (
          <div className="space-y-2">
            <Label>Coluna de destino</Label>
            <Select
              value={action.action_config?.column_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, 'column_id', value)}
              onOpenChange={(open) => {
                if (open && columns.length === 0 && !columnsLoading) {
                  loadColumns();
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={columnsLoading ? "Carregando..." : "Selecione uma coluna"} />
              </SelectTrigger>
              <SelectContent>
                {columnsLoading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Carregando colunas...
                  </div>
                ) : columns.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhuma coluna encontrada
                  </div>
                ) : (
                  columns
                    .filter(col => col.id !== columnId)
                    .map(col => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case 'add_tag':
        return (
          <div className="space-y-2">
            <Label>Tag</Label>
            <Select
              value={action.action_config?.tag_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, 'tag_id', value)}
              onOpenChange={(open) => {
                if (open && tags.length === 0 && !tagsLoading) {
                  loadTags();
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={tagsLoading ? "Carregando..." : "Selecione uma tag"} />
              </SelectTrigger>
              <SelectContent>
                {tagsLoading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Carregando tags...
                  </div>
                ) : tags.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhuma tag encontrada
                  </div>
                ) : (
                  tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case 'add_agent':
        return (
          <div className="space-y-2">
            <Label>Agente de IA</Label>
            <Select
              value={action.action_config?.agent_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, 'agent_id', value)}
              onOpenChange={(open) => {
                if (open && agents.length === 0 && !agentsLoading) {
                  loadAgents();
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={agentsLoading ? "Carregando..." : "Selecione um agente"} />
              </SelectTrigger>
              <SelectContent>
                {agentsLoading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Carregando agentes...
                  </div>
                ) : agents.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum agente encontrado
                  </div>
                ) : (
                  agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case 'remove_agent':
        return (
          <div className="space-y-2">
            <Label>Remover agente</Label>
            <Select
              value={action.action_config?.remove_current === true ? 'current' : (action.action_config?.agent_id || 'current')}
              onValueChange={(value) => {
                if (value === 'current') {
                  // Remover agente atual - não precisa de agent_id específico
                  updateActionConfig(action.id, 'remove_current', true);
                  updateActionConfig(action.id, 'agent_id', null);
                } else {
                  // Remover agente específico
                  updateActionConfig(action.id, 'remove_current', false);
                  updateActionConfig(action.id, 'agent_id', value);
                }
              }}
              onOpenChange={(open) => {
                if (open && agents.length === 0 && !agentsLoading) {
                  loadAgents();
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Remover agente atual</SelectItem>
                {agentsLoading ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Carregando agentes...
                  </div>
                ) : agents.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum agente encontrado
                  </div>
                ) : (
                  agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {action.action_config?.remove_current === true && (
              <p className="text-xs text-muted-foreground">
                Removerá qualquer agente que esteja ativo na conversa
              </p>
            )}
            {action.action_config?.remove_current === false && action.action_config?.agent_id && (
              <p className="text-xs text-muted-foreground">
                Removerá apenas o agente específico selecionado, se estiver ativo
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {automation ? 'Editar Automação' : 'Nova Automação'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nome e Descrição */}
          <div className="space-y-2">
            <Label htmlFor="automation-name">Nome da Automação *</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mensagem de boas-vindas quando entrar na coluna 'Pré-venda'"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="automation-description">Descrição</Label>
            <Textarea
              id="automation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito desta automação (opcional)"
              rows={2}
            />
          </div>

          {/* Gatilhos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Gatilhos</CardTitle>
                <Button variant="outline" size="sm" onClick={addTrigger}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar gatilho
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {triggers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum gatilho adicionado. Clique em "Adicionar gatilho" para começar.
                </p>
              ) : (
                triggers.map((trigger) => (
                  <div key={trigger.id} className="space-y-3 p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Select
                        value={trigger.trigger_type}
                        onValueChange={(value) => updateTrigger(trigger.id, 'trigger_type', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione o tipo de gatilho" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTrigger(trigger.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {trigger.trigger_type === 'time_in_column' && (
                      <div className="flex items-center gap-2 pt-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Tempo *"
                            min="1"
                            value={trigger.trigger_config?.time_value || ''}
                            onChange={(e) => updateTriggerConfig(trigger.id, 'time_value', e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Select
                            value={trigger.trigger_config?.time_unit || 'minutes'}
                            onValueChange={(value) => updateTriggerConfig(trigger.id, 'time_unit', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_UNITS.map(unit => (
                                <SelectItem key={unit.value} value={unit.value}>
                                  {unit.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    
                    {trigger.trigger_type === 'time_in_column' && (
                      <p className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-yellow-500">⚠</span>
                        Executa apenas uma vez quando o card atinge o tempo configurado na coluna
                      </p>
                    )}
                    
                    {trigger.trigger_type === 'message_received' && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label htmlFor={`message-count-${trigger.id}`}>Qtd. de mensagens *</Label>
                            <Input
                              id={`message-count-${trigger.id}`}
                              type="number"
                              placeholder="Ex: 3"
                              min="1"
                              value={trigger.trigger_config?.message_count || ''}
                              onChange={(e) => updateTriggerConfig(trigger.id, 'message_count', parseInt(e.target.value) || 1)}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-blue-500">ℹ</span>
                          Executa quando o contato enviar o número de mensagens especificado
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Ações */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Ações</CardTitle>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar ação
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma ação adicionada. Clique em "Adicionar ação" para começar.
                </p>
              ) : (
                actions.map((action) => (
                  <Card key={action.id} className="border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Ação #{action.action_order + 1}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAction(action.id)}
                          className="text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>Tipo de ação</Label>
                        <Select
                          value={action.action_type}
                          onValueChange={(value) => updateAction(action.id, 'action_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo de ação" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {action.action_type && renderActionFields(action)}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : automation ? "Atualizar" : "Criar"} Automação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

