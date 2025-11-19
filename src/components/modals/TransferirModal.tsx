import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { useQueues } from "@/hooks/useQueues";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface TransferirModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  selectedCards: string[];
  currentPipelineId: string;
  currentPipelineName: string;
  onTransferComplete: () => void;
}

export function TransferirModal({ 
  isOpen, 
  onClose, 
  isDarkMode = false,
  selectedCards,
  currentPipelineId,
  currentPipelineName,
  onTransferComplete
}: TransferirModalProps) {
  const [targetPipelineId, setTargetPipelineId] = useState("");
  const [targetColumnId, setTargetColumnId] = useState("");
  const [targetColumns, setTargetColumns] = useState<any[]>([]);
  const [targetQueueId, setTargetQueueId] = useState<string>("");
  const [targetResponsibleId, setTargetResponsibleId] = useState<string>("");
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { pipelines } = usePipelinesContext();
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();
  const { queues } = useQueues();

  // Fetch workspace users
  useEffect(() => {
    if (isOpen && selectedWorkspace?.workspace_id) {
      fetchWorkspaceUsers();
    }
  }, [isOpen, selectedWorkspace?.workspace_id]);

  // Fetch columns when pipeline changes
  useEffect(() => {
    if (targetPipelineId) {
      fetchColumns(targetPipelineId);
    } else {
      setTargetColumns([]);
      setTargetColumnId("");
    }
  }, [targetPipelineId]);

  const fetchWorkspaceUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'manage-system-user',
        {
          body: {
            action: 'list',
            userData: {}
          }
        }
      );

      if (error) {
        console.error('Error fetching workspace users:', error);
        return;
      }
      
      if (data?.error) {
        console.error('Error from edge function:', data.error);
        return;
      }

      if (!data?.success) {
        console.error('Invalid response from server');
        return;
      }

      // Filter only users from current workspace
      const allUsers = data.data || [];
      const users = allUsers.filter((user: any) => 
        user.workspaces?.some((ws: any) => 
          ws.id === selectedWorkspace?.workspace_id
        )
      );
      
      console.log('✅ Loaded workspace users:', users.length);
      setWorkspaceUsers(users);
    } catch (error) {
      console.error('Error fetching workspace users:', error);
    }
  };

  const fetchColumns = async (pipelineId: string) => {
    try {
      const headers = getHeaders();
      const { data, error } = await supabase.functions.invoke(
        `pipeline-management/columns?pipeline_id=${pipelineId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (error) throw error;
      setTargetColumns(data || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas do pipeline de destino",
        variant: "destructive",
      });
    }
  };

  const handleTransfer = async () => {
    if (!targetPipelineId || !targetColumnId) {
      toast({
        title: "Atenção",
        description: "Selecione o pipeline e a etapa de destino",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Transfer each selected card
      for (const cardId of selectedCards) {
        try {
          const updateBody: any = {
            pipeline_id: targetPipelineId,
            column_id: targetColumnId,
          };

          // Add optional fields if they are selected (empty string means clear the field)
          if (targetQueueId) {
            updateBody.queue_id = targetQueueId;
          }
          if (targetResponsibleId) {
            updateBody.responsible_user_id = targetResponsibleId;
          }

          const { error } = await supabase.functions.invoke(
            `pipeline-management/cards?id=${cardId}`,
            {
              method: 'PUT',
              headers,
              body: updateBody,
            }
          );

          if (error) {
            errorCount++;
            // Check if it's a duplicate constraint error
            if (error.message?.includes('idx_unique_contact_pipeline_open')) {
              errors.push('Um ou mais contatos já possuem negócios abertos no pipeline de destino');
            } else {
              throw error;
            }
          } else {
            successCount++;
          }
        } catch (err) {
          console.error('Error transferring card:', cardId, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Sucesso",
          description: `${successCount} negócio(s) transferido(s) com sucesso`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: errorCount === selectedCards.length ? "Erro" : "Atenção",
          description: errors.length > 0 
            ? errors[0] 
            : `${errorCount} negócio(s) não puderam ser transferidos`,
          variant: "destructive",
        });
      }

      // Close first, then refresh
      onClose();
      
      // Give a small delay to ensure the modal is closed before refresh
      setTimeout(() => {
        onTransferComplete();
      }, 100);
    } catch (error) {
      console.error('Error transferring cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir negócios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-md",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white border-gray-200 text-gray-900"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Transferir Negócios Selecionados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Origem */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Origem:
            </Label>
            <p className={cn(
              "mt-1 text-sm font-semibold",
              isDarkMode ? "text-white" : "text-gray-900"
            )}>
              {currentPipelineName}
            </p>
            <p className={cn(
              "text-xs mt-1",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}>
              {selectedCards.length} negócio(s) selecionado(s) será(ão) transferido(s)
            </p>
          </div>

          {/* Pipeline de Destino */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Pipeline de Destino
            </Label>
            <Select value={targetPipelineId} onValueChange={setTargetPipelineId}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                {pipelines
                  .filter(p => p.is_active)
                  .map(pipeline => (
                    <SelectItem 
                      key={pipeline.id} 
                      value={pipeline.id}
                      className={cn(
                        isDarkMode 
                          ? "text-white hover:bg-gray-600" 
                          : "text-gray-900 hover:bg-gray-100"
                      )}
                    >
                      {pipeline.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa de Destino */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Etapa de Destino
            </Label>
            <Select 
              value={targetColumnId} 
              onValueChange={setTargetColumnId}
              disabled={!targetPipelineId}
            >
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                {targetColumns.map(column => (
                  <SelectItem 
                    key={column.id} 
                    value={column.id}
                    className={cn(
                      isDarkMode 
                        ? "text-white hover:bg-gray-600" 
                        : "text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fila (Opcional) */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Fila (Opcional)
            </Label>
            <Select 
              value={targetQueueId} 
              onValueChange={(value) => setTargetQueueId(value === "clear" ? "" : value)}
            >
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Sem fila" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem 
                  value="clear"
                  className={cn(
                    isDarkMode 
                      ? "text-white hover:bg-gray-600" 
                      : "text-gray-900 hover:bg-gray-100"
                  )}
                >
                  Sem fila
                </SelectItem>
                {queues.map(queue => (
                  <SelectItem 
                    key={queue.id} 
                    value={queue.id}
                    className={cn(
                      isDarkMode 
                        ? "text-white hover:bg-gray-600" 
                        : "text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável (Opcional) */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Responsável (Opcional)
            </Label>
            <Select 
              value={targetResponsibleId} 
              onValueChange={(value) => setTargetResponsibleId(value === "clear" ? "" : value)}
            >
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem 
                  value="clear"
                  className={cn(
                    isDarkMode 
                      ? "text-white hover:bg-gray-600" 
                      : "text-gray-900 hover:bg-gray-100"
                  )}
                >
                  Sem responsável
                </SelectItem>
                {workspaceUsers.map(user => (
                  <SelectItem 
                    key={user.id} 
                    value={user.id}
                    className={cn(
                      isDarkMode 
                        ? "text-white hover:bg-gray-600" 
                        : "text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className={cn(
              isDarkMode 
                ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isLoading || !targetPipelineId || !targetColumnId}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? "Transferindo..." : `Transferir ${selectedCards.length} Negócio(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
