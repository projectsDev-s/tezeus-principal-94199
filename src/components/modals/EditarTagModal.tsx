import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplet } from "lucide-react";
import { ColorPickerModal } from "./ColorPickerModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface EditarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagUpdated: () => void;
  tag: Tag | null;
}

export function EditarTagModal({ isOpen, onClose, onTagUpdated, tag }: EditarTagModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6e0c0c");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color);
    }
  }, [tag]);

  const handleColorSelect = (newColor: string) => {
    setColor(newColor);
    setIsColorPickerOpen(false);
  };

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da tag é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!tag?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tags')
        .update({
          name: name.trim(),
          color: color,
        })
        .eq('id', tag.id);

      if (error) throw error;

      toast({
        title: "Tag atualizada",
        description: `A tag "${name}" foi atualizada com sucesso.`,
      });

      onTagUpdated();
      onClose();
    } catch (error: any) {
      console.error('Erro ao atualizar tag:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Editar Tag
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Campo Nome */}
            <div>
              <Label htmlFor="tagName" className="text-sm font-medium text-gray-700">
                Nome
              </Label>
              <Input
                id="tagName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite o nome da tag"
                className="mt-1 bg-white border-gray-300 text-gray-900"
              />
            </div>

            {/* Seletor de Cor */}
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Cor
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-10 h-10 rounded-full border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <Input
                  value={color}
                  readOnly
                  className="flex-1 bg-gray-50 border-gray-300 text-gray-900"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColorPickerOpen(true)}
                  className="p-2 border-gray-300"
                >
                  <Droplet className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={isColorPickerOpen}
        onOpenChange={setIsColorPickerOpen}
        onColorSelect={handleColorSelect}
      />
    </>
  );
}