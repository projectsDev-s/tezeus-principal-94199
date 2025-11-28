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
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border border-[#d4d4d4] shadow-lg sm:rounded-none bg-white">
        <DialogHeader className="mx-0 mt-0 px-6 py-4 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none flex-shrink-0">
          <DialogTitle>Marcar como perdido</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="loss-reason" className="text-xs font-medium text-gray-700">Motivo da perda</Label>
            <Select
              value={selectedReasonId}
              onValueChange={handleReasonChange}
              disabled={loadingReasons}
            >
              <SelectTrigger id="loss-reason" className="h-8 text-xs border-gray-300 rounded-none">
                <SelectValue placeholder="Escolha um motivo" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-gray-300">
                {loadingReasons ? (
                  <SelectItem value="loading" disabled className="text-xs">
                    Carregando...
                  </SelectItem>
                ) : (
                  <>
                    {lossReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id} className="text-xs cursor-pointer focus:bg-gray-100">
                        {reason.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="outros" className="text-xs cursor-pointer focus:bg-gray-100">Outro...</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {showOtherInput && (
            <div className="space-y-2">
              <Label htmlFor="other-reason" className="text-xs font-medium text-gray-700">Especifique o motivo</Label>
              <Input
                id="other-reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Digite o motivo da perda"
                className="h-8 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comments" className="text-xs font-medium text-gray-700">Comentários (opcional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Adicione detalhes sobre a perda..."
              rows={3}
              className="text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
            />
          </div>

          <Alert className="bg-blue-50 border-blue-200 rounded-none">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-800">
              Informar um motivo de perda pode ajudar você identificar e compreender melhor certas tendências ou deficiências e analisar o seu histórico de negócios.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-[#d4d4d4] mt-auto">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="h-8 text-xs bg-white border-gray-300 rounded-none hover:bg-gray-100 text-gray-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white rounded-none border-transparent"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Marcando...
              </>
            ) : (
              'Marcar como perdido'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
