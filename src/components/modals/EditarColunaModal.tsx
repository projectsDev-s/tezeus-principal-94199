import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ColorPickerModal } from "./ColorPickerModal";
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

interface EditarColunaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string | null;
  columnName: string;
  columnColor: string;
  onUpdate: () => void;
}

export function EditarColunaModal({
  open,
  onOpenChange,
  columnId,
  columnName,
  columnColor,
  onUpdate,
}: EditarColunaModalProps) {
  const [name, setName] = useState(columnName);
  const [color, setColor] = useState(columnColor);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();

  useEffect(() => {
    if (open) {
      setName(columnName);
      setColor(columnColor);
    }
  }, [open, columnName, columnColor]);

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da coluna não pode estar vazio",
        variant: "destructive",
      });
      return;
    }

    if (!columnId) return;

    try {
      setIsLoading(true);
      const headers = getHeaders();

      const { error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'PUT',
        headers,
        body: {
          column_id: columnId,
          name: name.trim(),
          color,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Coluna atualizada com sucesso",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar coluna:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar coluna",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurações da Coluna</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="column-name">Nome da Coluna</Label>
              <Input
                id="column-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite o nome da coluna"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded border cursor-pointer"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPicker(true)}
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={showColorPicker}
        onOpenChange={setShowColorPicker}
        onColorSelect={handleColorSelect}
      />
    </>
  );
}
