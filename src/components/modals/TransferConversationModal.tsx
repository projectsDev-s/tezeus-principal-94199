import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { Queue } from "@/hooks/useQueues";
import { WorkspaceConnection } from "@/hooks/useWorkspaceConnections";
import { useConversationAssign } from "@/hooks/useConversationAssign";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AssignmentEntry } from "@/hooks/useConversationAssignments";

type TransferConversationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WhatsAppConversation | null;
  users: WorkspaceMember[];
  queues: Queue[];
  connections: WorkspaceConnection[];
  isLoadingConnections?: boolean;
  isLoadingQueues?: boolean;
  onTransferSuccess?: (params: {
    conversationId: string;
    assignedUserId: string;
    assignedUserName?: string | null;
    connectionId: string;
    queueId?: string | null;
  }) => void;
};

export function TransferConversationModal({
  open,
  onOpenChange,
  conversation,
  users,
  queues,
  connections,
  isLoadingConnections,
  isLoadingQueues,
  onTransferSuccess,
}: TransferConversationModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("none");
  const [selectedConnectionId, setSelectedConnectionId] =
    useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { assignConversation, isAssigning } = useConversationAssign();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const userOptions = useMemo(() => {
    return users
      .map((member) => {
        const userId = member.user?.id || member.user_id;
        if (!userId) return null;
        return {
          id: userId,
          name: member.user?.name || "Usuário sem nome",
        };
      })
      .filter(Boolean) as { id: string; name: string }[];
  }, [users]);

  const queueOptions = useMemo(() => {
    return queues.map((queue) => ({
      id: queue.id,
      name: queue.name,
    }));
  }, [queues]);

  const connectionOptions = useMemo(() => {
    return connections.map((connection) => ({
      id: connection.id,
      name: connection.instance_name,
    }));
  }, [connections]);

  useEffect(() => {
    if (!open) {
      setSelectedUserId("");
      setSelectedQueueId("none");
      setSelectedConnectionId("");
      setIsSubmitting(false);
      return;
    }

    if (conversation) {
      setSelectedUserId(conversation.assigned_user_id || "");
      setSelectedQueueId(
        (conversation.queue_id as string | null | undefined) || "none"
      );
      setSelectedConnectionId(conversation.connection_id || "");
    }
  }, [open, conversation?.id]);

  const handleSubmit = async () => {
    if (!conversation) return;
    if (!selectedUserId) {
      toast({
        title: "Selecione um usuário",
        description: "É necessário escolher um responsável para o atendimento.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedConnectionId) {
      toast({
        title: "Selecione uma conexão",
        description: "Escolha a conexão para onde o atendimento será movido.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const previousUserId = conversation.assigned_user_id || null;
      const previousUserName =
        (previousUserId &&
          (userOptions.find((option) => option.id === previousUserId)?.name ||
            conversation.assigned_user_name)) ||
        "Não atribuído";

      const assignResult = await assignConversation(
        conversation.id,
        selectedUserId
      );

      if (!assignResult.success) {
        throw new Error(
          assignResult.error || "Falha ao atribuir este atendimento."
        );
      }

      const updates: Record<string, string | null> = {
        connection_id: selectedConnectionId,
      };

      if (selectedQueueId === "none") {
        updates.queue_id = null;
      } else if (selectedQueueId) {
        updates.queue_id = selectedQueueId;
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update(updates)
        .eq("id", conversation.id);

      if (updateError) {
        throw updateError;
      }

      const assignedUserNameResolved =
        userOptions.find((option) => option.id === selectedUserId)?.name || null;

      toast({
        title: "Atendimento transferido",
        description: "As alterações foram aplicadas com sucesso.",
      });

      queryClient.invalidateQueries({
        queryKey: ["conversation-assignments", conversation.id],
      });

      const optimisticAssignedUserName =
        userOptions.find((option) => option.id === selectedUserId)?.name ??
        conversation.assigned_user_name ??
        "Usuário";

      const optimisticEntry: AssignmentEntry = {
        id: `temp_${Date.now()}`,
        action: previousUserId ? "transfer" : "assign",
        changed_at: new Date().toISOString(),
        changed_by: user?.id || null,
        from_assigned_user_id: previousUserId,
        to_assigned_user_id: selectedUserId,
        from_user_name: previousUserName,
        to_user_name: optimisticAssignedUserName,
        changed_by_name: user?.name || null,
      };

      queryClient.setQueryData<AssignmentEntry[] | undefined>(
        ["conversation-assignments", conversation.id],
        (oldData) => {
          if (!oldData) {
            return [optimisticEntry];
          }
          return [optimisticEntry, ...oldData];
        }
      );

      onTransferSuccess?.({
        conversationId: conversation.id,
        assignedUserId: selectedUserId,
        assignedUserName: assignedUserNameResolved,
        connectionId: selectedConnectionId,
        queueId:
          selectedQueueId === "none" ? null : (selectedQueueId as string),
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao transferir atendimento:", error);
      toast({
        title: "Erro ao transferir",
        description:
          error?.message || "Não foi possível concluir a transferência.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing =
    isSubmitting || (isAssigning ? isAssigning === conversation?.id : false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Transferir Atendimento</DialogTitle>
          <DialogDescription>
            Escolha o novo responsável, fila (opcional) e conexão para este
            atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Usuário responsável <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isProcessing || userOptions.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {userOptions.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    Nenhum usuário disponível
                  </SelectItem>
                ) : (
                  userOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Fila (opcional)
            </Label>
            <Select
              value={selectedQueueId}
              onValueChange={setSelectedQueueId}
              disabled={isProcessing || isLoadingQueues}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma fila (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem fila</SelectItem>
                {queueOptions.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Conexão <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedConnectionId}
              onValueChange={setSelectedConnectionId}
              disabled={isProcessing || isLoadingConnections}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent>
                {connectionOptions.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    Nenhuma conexão disponível
                  </SelectItem>
                ) : (
                  connectionOptions.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transferindo...
              </span>
            ) : (
              "Transferir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

