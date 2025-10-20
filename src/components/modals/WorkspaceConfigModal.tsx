import { Cable } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

        <div className="mt-6 space-y-4">
          <ConexoesNova workspaceId={workspaceId} />
        </div>
      </DialogContent>
    </Dialog>;
}