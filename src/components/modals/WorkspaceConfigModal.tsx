import { Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConexoesNova } from "@/components/modules/ConexoesNova";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";

interface WorkspaceConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

interface Pipeline {
  id: string;
  name: string;
}

export function WorkspaceConfigModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName
}: WorkspaceConfigModalProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [defaultPipelineId, setDefaultPipelineId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && workspaceId) {
      loadPipelines();
      loadDefaultPipeline();
    }
  }, [open, workspaceId]);

  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers: getWorkspaceHeaders(workspaceId)
      });

      if (error) throw error;
      setPipelines(data || []);
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    }
  };

  const loadDefaultPipeline = async () => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('default_pipeline_id')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      setDefaultPipelineId(data?.default_pipeline_id || "none");
    } catch (error) {
      console.error('Erro ao carregar pipeline padrão:', error);
    }
  };

  const handleSaveDefaultPipeline = async () => {
    try {
      setIsLoading(true);
      
      const headers = getWorkspaceHeaders(workspaceId);
      
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: {
          action: 'update',
          workspaceId,
          name: workspaceName,
          defaultPipelineId: defaultPipelineId === "none" ? null : defaultPipelineId
        },
        headers
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pipeline padrão configurada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao salvar pipeline padrão:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar pipeline padrão.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações da Empresa: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="mt-6">
            <ConexoesNova workspaceId={workspaceId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}