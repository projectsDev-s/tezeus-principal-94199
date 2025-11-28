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
      console.log('🔍 Criando coluna com dados:', { name: name.trim(), color, icon });
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
        <DialogContent className="sm:max-w-md p-0 gap-0 border border-[#d4d4d4] shadow-sm rounded-none bg-white">
          <DialogHeader className="bg-primary p-4 rounded-none m-0 border-b border-[#d4d4d4]">
            <DialogTitle className="text-primary-foreground text-base font-bold">
              Adicionar Coluna
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="column-name" className="text-xs font-bold text-gray-700">Nome da Coluna *</Label>
              <Input
                id="column-name"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs rounded-none border-gray-300 bg-white text-gray-900 focus-visible:ring-0"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Ícone *</Label>
              <IconSelector 
                selectedIcon={icon}
                onIconSelect={setIcon}
              />
              <p className="text-[10px] text-muted-foreground">
                Selecione um ícone para representar esta etapa do pipeline
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-700">Cor</Label>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-none border border-gray-300 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPicker(true)}
                >
                  <Pipette 
                    className="w-3.5 h-3.5 text-white drop-shadow-lg" 
                    onClick={() => setShowColorPicker(true)}
                  />
                </div>
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 h-8 text-xs rounded-none border-gray-300 bg-white text-gray-900 focus-visible:ring-0"
                  placeholder="#000000"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-[#d4d4d4] mt-4 -mx-6 -mb-6 p-4 bg-gray-50">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs rounded-none border-gray-300 bg-white hover:bg-gray-100 text-gray-700"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                className="h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground"
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