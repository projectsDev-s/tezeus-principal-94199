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
  const [isLoading, setIsLoading] = useState(false);
  
  const { pipelines } = usePipelinesContext();
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();

  // Fetch columns when pipeline changes
  useEffect(() => {
    if (targetPipelineId) {
      fetchColumns(targetPipelineId);
    } else {
      setTargetColumns([]);
      setTargetColumnId("");
    }
  }, [targetPipelineId]);

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

      // Transfer each selected card
      for (const cardId of selectedCards) {
        const { error } = await supabase.functions.invoke(
          `pipeline-management/cards?id=${cardId}`,
          {
            method: 'PUT',
            headers,
            body: {
              pipeline_id: targetPipelineId,
              column_id: targetColumnId,
            },
          }
        );

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `${selectedCards.length} negócio(s) transferido(s) com sucesso`,
      });

      onTransferComplete();
      onClose();
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
