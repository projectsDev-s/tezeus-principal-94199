import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLossReasons } from '@/hooks/useLossReasons';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MarkAsLostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (lossReasonId: string | null, comments: string) => void;
  workspaceId: string;
  isLoading?: boolean;
}

export const MarkAsLostModal: React.FC<MarkAsLostModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  workspaceId,
  isLoading = false,
}) => {
  const { lossReasons, isLoading: loadingReasons } = useLossReasons(workspaceId);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherReason, setOtherReason] = useState('');
  const [comments, setComments] = useState('');

  const handleReasonChange = (value: string) => {
    setSelectedReasonId(value);
    setShowOtherInput(value === 'outros');
    if (value !== 'outros') {
      setOtherReason('');
    }
  };

  const handleConfirm = () => {
    if (showOtherInput) {
      onConfirm(null, otherReason || comments);
    } else {
      onConfirm(selectedReasonId || null, comments);
    }
    handleClose();
  };

  const handleClose = () => {
    setSelectedReasonId('');
    setShowOtherInput(false);
    setOtherReason('');
    setComments('');
    onOpenChange(false);
  };

  const canConfirm = selectedReasonId && (!showOtherInput || otherReason.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Marcar como perdido</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Motivo da perda</Label>
            <Select
              value={selectedReasonId}
              onValueChange={handleReasonChange}
              disabled={loadingReasons}
            >
              <SelectTrigger id="loss-reason">
                <SelectValue placeholder="Escolha um motivo" />
              </SelectTrigger>
              <SelectContent>
                {loadingReasons ? (
                  <SelectItem value="loading" disabled>
                    Carregando...
                  </SelectItem>
                ) : (
                  <>
                    {lossReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="outros">Outro...</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {showOtherInput && (
            <div className="space-y-2">
              <Label htmlFor="other-reason">Especifique o motivo</Label>
              <Input
                id="other-reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Digite o motivo da perda"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comments">Comentários (opcional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Adicione detalhes sobre a perda..."
              rows={3}
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Informar um motivo de perda pode ajudar você identificar e compreender melhor certas tendências ou deficiências e analisar o seu histórico de negócios.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Marcando...
              </>
            ) : (
              'Marcar como perdido'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
