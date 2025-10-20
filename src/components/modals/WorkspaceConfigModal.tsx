import { Cable, Wifi, Bot, Headphones } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConexoesNova } from "@/components/modules/ConexoesNova";
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
            <Cable className="w-5 h-5" />
            Conexões da Empresa: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connections" className="flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              Conexões
            </TabsTrigger>
            
            
          </TabsList>

          <TabsContent value="connections" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Conexões WhatsApp/Evolution</h3>
              <ConexoesNova workspaceId={workspaceId} />
            </div>
          </TabsContent>

          <TabsContent value="automations" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Automações</h3>
              <p className="text-muted-foreground">
                Configure automações específicas para este workspace.
              </p>
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                Funcionalidade de automações em desenvolvimento...
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dsvoice" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">DS Voice</h3>
              <p className="text-muted-foreground">
                Configure DS Voice específico para este workspace.
              </p>
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                Funcionalidade DS Voice em desenvolvimento...
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>;
}