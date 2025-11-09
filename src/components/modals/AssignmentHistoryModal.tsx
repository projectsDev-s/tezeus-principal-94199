import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConversationAssignments } from "@/hooks/useConversationAssignments";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserCircle, ArrowRight, UserPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AssignmentHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function AssignmentHistoryModal({
  isOpen,
  onOpenChange,
  conversationId,
}: AssignmentHistoryModalProps) {
  const { data: assignments, isLoading } = useConversationAssignments(conversationId);

  const getActionText = (action: string) => {
    switch (action) {
      case 'assigned':
        return 'Atribuída';
      case 'transferred':
        return 'Transferida';
      case 'reassigned':
        return 'Reatribuída';
      default:
        return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'assigned':
        return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'transferred':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      default:
        return <UserCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de Transferências</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
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
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="mt-1">
                    {getActionIcon(assignment.action)}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {getActionText(assignment.action)}
                      </span>
                      
                      {assignment.from_user_name && (
                        <>
                          <span className="text-muted-foreground text-sm">de</span>
                          <span className="text-sm font-medium text-foreground">
                            {assignment.from_user_name}
                          </span>
                        </>
                      )}
                      
                      {assignment.to_user_name && (
                        <>
                          <span className="text-muted-foreground text-sm">para</span>
                          <span className="text-sm font-medium text-foreground">
                            {assignment.to_user_name}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatDistanceToNow(new Date(assignment.changed_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                      
                      {assignment.changed_by_name && (
                        <>
                          <span>•</span>
                          <span>por {assignment.changed_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma transferência registrada</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
