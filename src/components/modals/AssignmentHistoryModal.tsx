import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConversationAssignments } from "@/hooks/useConversationAssignments";
import { useAgentHistory } from "@/hooks/useAgentHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserCircle, ArrowRight, UserPlus, Clock, Bot, Power, PowerOff, ArrowRightLeft, User, UserMinus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AssignmentHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

const assignmentActionConfig: Record<string, {
  icon: React.ReactNode;
  label: string;
  badgeClass: string;
}> = {
  accept: {
    icon: <UserPlus className="h-4 w-4 text-blue-500" />,
    label: 'Aceito manualmente',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  assign: {
    icon: <UserPlus className="h-4 w-4 text-blue-500" />,
    label: 'Atribuído',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  transfer: {
    icon: <ArrowRight className="h-4 w-4 text-orange-500" />,
    label: 'Transferido',
    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  },
  unassign: {
    icon: <UserMinus className="h-4 w-4 text-red-500" />,
    label: 'Responsável removido',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
};

const agentActionIcons = {
  activated: <Power className="h-4 w-4 text-green-500" />,
  deactivated: <PowerOff className="h-4 w-4 text-red-500" />,
  changed: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
};

const agentActionLabels = {
  activated: 'Agente ativado',
  deactivated: 'Agente desativado',
  changed: 'Agente alterado',
};

const agentActionColors = {
  activated: 'bg-green-500/10 text-green-700 dark:text-green-400',
  deactivated: 'bg-red-500/10 text-red-700 dark:text-red-400',
  changed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

type AgentActionKey = keyof typeof agentActionLabels;

const normalizeAgentId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return value ? String(value) : null;
};

const resolveAgentDisplayAction = (agent: any): AgentActionKey => {
  if (agent?.action === 'changed') {
    const previousAgentId = normalizeAgentId(agent?.metadata?.old_agent_id);
    if (!previousAgentId) {
      return 'activated';
    }
  }
  return (agent?.action ?? 'activated') as AgentActionKey;
};

export function AssignmentHistoryModal({
  isOpen,
  onOpenChange,
  conversationId,
}: AssignmentHistoryModalProps) {
  const { data: assignments, isLoading: assignmentsLoading } = useConversationAssignments(conversationId);
  const { data: agentHistory, isLoading: agentLoading } = useAgentHistory(conversationId);

  // Combinar e ordenar ambos os históricos por data
  const combinedHistory = React.useMemo(() => {
    const combined: Array<{ type: 'assignment' | 'agent', data: any, timestamp: string }> = [];
    
    if (assignments) {
      assignments.forEach(a => combined.push({ 
        type: 'assignment', 
        data: a, 
        timestamp: a.changed_at 
      }));
    }
    
    if (agentHistory) {
      agentHistory.forEach(h => combined.push({ type: 'agent', data: h, timestamp: h.created_at }));
    }
    
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [assignments, agentHistory]);

  const isLoading = assignmentsLoading || agentLoading;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Agentes e Transferências
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-4 border rounded-lg">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : combinedHistory && combinedHistory.length > 0 ? (
            <div className="space-y-4">
              {combinedHistory.map((entry, index) => {
                if (entry.type === 'assignment') {
                  const assignment = entry.data;
                  const assignmentConfig = assignmentActionConfig[assignment.action] ?? {
                    icon: <UserCircle className="h-4 w-4 text-muted-foreground" />,
                    label: assignment.action ?? 'Ação desconhecida',
                    badgeClass: 'bg-muted text-foreground',
                  };
                  const fromUserName = assignment.from_user_name || 'Não atribuído';
                  const toUserName = assignment.to_user_name || 'Não atribuído';
                  return (
                    <div
                      key={`assignment-${assignment.id}`}
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="mt-1">
                        {assignmentConfig.icon}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={assignmentConfig.badgeClass}>
                            {assignmentConfig.label}
                          </Badge>
                          
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>
                              de{' '}
                              <span className="font-medium text-foreground">
                                {fromUserName}
                              </span>
                            </span>
                            <ArrowRight className="h-3 w-3 mx-1" />
                            <span>
                              para{' '}
                              <span className="font-medium text-foreground">
                                {toUserName}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(assignment.changed_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {assignment.changed_by_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Por {assignment.changed_by_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {new Date(assignment.changed_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  );
                } else {
                  const agent = entry.data;
                  const displayAction = resolveAgentDisplayAction(agent);
                  return (
                    <div
                      key={`agent-${agent.id}`}
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="mt-1">
                        {agentActionIcons[displayAction]}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={agentActionColors[displayAction]}>
                            {agentActionLabels[displayAction]}
                          </Badge>
                          
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Bot className="h-3 w-3" />
                            <span className="font-medium text-foreground">{agent.agent_name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(agent.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {agent.changed_by && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Por usuário</span>
                            </div>
                          )}
                        </div>

                        {agent.metadata && Object.keys(agent.metadata).length > 0 && 
                         !(agent.metadata.old_agent_id === null && Object.keys(agent.metadata).length === 1) && (
                          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                            {JSON.stringify(agent.metadata, null, 2)}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {new Date(agent.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum histórico encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                As mudanças de agentes e transferências serão registradas aqui
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
