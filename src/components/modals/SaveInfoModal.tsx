import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fieldName: string, fieldValue: string) => void;
}

export function SaveInfoModal({
  open,
  onOpenChange,
  onSave,
}: SaveInfoModalProps) {
  const [fieldName, setFieldName] = useState("");
  const [fieldValue, setFieldValue] = useState("");

  const handleSave = () => {
    if (!fieldName.trim() || !fieldValue.trim()) {
      return;
    }
    onSave(fieldName.trim(), fieldValue.trim());
    setFieldName("");
    setFieldValue("");
  };

  const handleCancel = () => {
    setFieldName("");
    setFieldValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Informação Adicional</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">Nome do Campo</Label>
            <Input
              id="field-name"
              placeholder="Ex: nome_cliente, cpf, endereco"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-value">Valor</Label>
            <Input
              id="field-value"
              placeholder="Ex: João Silva, 123.456.789-00"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!fieldName.trim() || !fieldValue.trim()}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
