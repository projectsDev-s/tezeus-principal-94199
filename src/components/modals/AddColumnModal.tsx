import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pipette } from "lucide-react";
import { ColorPickerModal } from "./ColorPickerModal";
import { IconSelector } from "@/components/ui/icon-selector";

interface AddColumnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddColumn: (name: string, color: string, icon: string) => void;
  isDarkMode?: boolean;
}

export function AddColumnModal({ open, onOpenChange, onAddColumn, isDarkMode = false }: AddColumnModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ff0000");
  const [icon, setIcon] = useState("Circle");
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSubmit = () => {
    if (name.trim() && icon) {
      onAddColumn(name.trim(), color, icon);
      setName("");
      setColor("#ff0000");
      setIcon("Circle");
      onOpenChange(false);
    }
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              Adicionar Coluna
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="column-name">Nome da Coluna *</Label>
              <Input
                id="column-name"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone *</Label>
              <IconSelector 
                selectedIcon={icon}
                onIconSelect={setIcon}
              />
              <p className="text-xs text-muted-foreground">
                Selecione um ícone para representar esta etapa do pipeline
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPicker(true)}
                >
                  <Pipette 
                    className="w-4 h-4 text-white drop-shadow-lg" 
                    onClick={() => setShowColorPicker(true)}
                  />
                </div>
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 bg-input border-border text-foreground"
                  placeholder="#000000"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-border text-card-foreground hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={!name.trim() || !icon}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={showColorPicker}
        onOpenChange={setShowColorPicker}
        onColorSelect={handleColorSelect}
        isDarkMode={isDarkMode}
      />
    </>
  );
}