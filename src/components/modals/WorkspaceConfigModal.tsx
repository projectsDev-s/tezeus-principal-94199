import { Cable, Webhook, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConexoesNova } from "@/components/modules/ConexoesNova";
import { WebhooksEvolutionConfig } from "@/components/modules/WebhooksEvolutionConfig";
import { EvolutionApiConfig } from "@/components/modules/EvolutionApiConfig";
interface WorkspaceConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}
export function WorkspaceConfigModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName
}: WorkspaceConfigModalProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações da Empresa: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="conexoes" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conexoes" className="flex items-center gap-2">
              <Cable className="w-4 h-4" />
              Conexões
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks Evolution
            </TabsTrigger>
            <TabsTrigger value="evolution-api" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Evolution API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conexoes" className="mt-6">
            <ConexoesNova workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <WebhooksEvolutionConfig workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="evolution-api" className="mt-6">
            <EvolutionApiConfig workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>;
}