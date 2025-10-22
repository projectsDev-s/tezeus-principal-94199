import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { FolderKanban, ChevronRight, AlertCircle } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PipelineColumnSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (pipelineId: string, pipelineName: string, columnId: string, columnName: string) => void;
}

export const PipelineColumnSelectorModal: React.FC<PipelineColumnSelectorModalProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  const { selectedWorkspace } = useWorkspace();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  
  // Só tenta buscar se tem workspace selecionado
  const { pipelines, isLoading: loadingPipelines } = usePipelines();
  const { columns, isLoading: loadingColumns } = usePipelineColumns(selectedPipelineId);

  // Limpar seleção ao fechar
  useEffect(() => {
    if (!open) {
      setSelectedPipelineId(null);
    }
  }, [open]);

  const handlePipelineClick = (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
  };

  const handleColumnClick = (columnId: string, columnName: string) => {
    if (selectedPipelineId) {
      const pipeline = pipelines.find(p => p.id === selectedPipelineId);
      if (pipeline) {
        onSelect(selectedPipelineId, pipeline.name, columnId, columnName);
        setSelectedPipelineId(null);
      }
    }
  };

  const handleBack = () => {
    setSelectedPipelineId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedPipelineId ? 'Selecionar Coluna' : 'Selecionar Pipeline'}
          </DialogTitle>
        </DialogHeader>

        {!selectedWorkspace ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum workspace selecionado. Por favor, selecione um workspace primeiro.
            </AlertDescription>
          </Alert>
        ) : selectedPipelineId ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="w-full justify-start"
            >
              ← Voltar para Pipelines
            </Button>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {loadingColumns ? (
                  <p className="text-sm text-muted-foreground p-4">Carregando colunas...</p>
                ) : columns.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhuma coluna encontrada</p>
                ) : (
                  columns.map((column) => (
                    <Button
                      key={column.id}
                      variant="outline"
                      className="w-full justify-start gap-2 h-auto p-3"
                      onClick={() => handleColumnClick(column.id, column.name)}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: column.color }}
                      />
                      <span className="flex-1 text-left">{column.name}</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {loadingPipelines ? (
                <p className="text-sm text-muted-foreground p-4">Carregando pipelines...</p>
              ) : pipelines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhum pipeline encontrado</p>
              ) : (
                pipelines.map((pipeline) => (
                  <Button
                    key={pipeline.id}
                    variant="outline"
                    className="w-full justify-start gap-2 h-auto p-3"
                    onClick={() => handlePipelineClick(pipeline.id)}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span className="flex-1 text-left">{pipeline.name}</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
