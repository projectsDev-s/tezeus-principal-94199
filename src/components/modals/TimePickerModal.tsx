import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeSelect: (hour: number) => void;
  selectedHour?: number | null;
  isDarkMode?: boolean;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isOpen,
  onClose,
  onTimeSelect,
  selectedHour = null,
  isDarkMode = false,
}) => {
  const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM');
  const [currentHour, setCurrentHour] = React.useState<number | null>(selectedHour !== null && selectedHour !== undefined
    ? selectedHour % 12
    : null);
  const [hasSelection, setHasSelection] = React.useState<boolean>(selectedHour !== null && selectedHour !== undefined);
  const hours = Array.from({ length: 12 }, (_, i) => i);

  React.useEffect(() => {
    if (isOpen) {
      const initialHour = selectedHour ?? null;
      const hasInitialSelection = initialHour !== null;
      const displayHour = hasInitialSelection ? (initialHour % 12 === 0 ? 12 : initialHour % 12) : null;

      setHasSelection(hasInitialSelection);
      setCurrentHour(displayHour);
      if (hasInitialSelection) {
        setPeriod(initialHour >= 12 ? 'PM' : 'AM');
      }
    } else {
      // Ao fechar o modal, o ponteiro deve voltar para o centro até uma nova seleção
      setHasSelection(selectedHour !== null && selectedHour !== undefined);
      if (selectedHour === null || selectedHour === undefined) {
        setCurrentHour(null);
        setPeriod('AM');
      }
    }
  }, [isOpen, selectedHour]);

  const handleHourSelect = (hour: number) => {
    const displayHour = hour === 0 ? 12 : hour;
    setCurrentHour(displayHour);
    setHasSelection(true);
    // Converter para formato 24h
    const hour24 = period === 'PM' && displayHour !== 12 ? displayHour + 12 : displayHour === 12 && period === 'AM' ? 0 : displayHour;
    onTimeSelect(hour24);
  };

  const pointerAngle = currentHour !== null
    ? (((currentHour % 12) || 0) * 30)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "sm:max-w-md",
        isDarkMode ? "bg-[#1a1a1a] border-gray-700" : "bg-white"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-center",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Selecionar Hora
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 p-4">
          {/* Toggle AM/PM */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={period === 'AM' ? 'default' : 'outline'}
              onClick={() => setPeriod('AM')}
              className={cn(
                "px-6",
                period === 'AM' 
                  ? "bg-blue-500 hover:bg-blue-600 text-white" 
                  : isDarkMode ? "text-gray-300 border-gray-600" : "text-gray-700"
              )}
            >
              AM
            </Button>
            <Button
              variant={period === 'PM' ? 'default' : 'outline'}
              onClick={() => setPeriod('PM')}
              className={cn(
                "px-6",
                period === 'PM' 
                  ? "bg-blue-500 hover:bg-blue-600 text-white" 
                  : isDarkMode ? "text-gray-300 border-gray-600" : "text-gray-700"
              )}
            >
              PM
            </Button>
          </div>

          {/* Relógio Visual */}
          <div className="relative w-72 h-72">
            <div className={cn(
              "w-full h-full rounded-full flex items-center justify-center relative",
              isDarkMode ? "bg-gray-800" : "bg-gray-100"
            )}>
              {/* Números das horas */}
              {hours.map((hour) => {
                const displayHour = hour === 0 ? 12 : hour;
                const angle = (displayHour * 30) - 90;
                const radius = 110;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                const isSelected = currentHour === displayHour;
                
                return (
                  <button
                    key={hour}
                    className={cn(
                      "absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all z-10 border border-transparent",
                      isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900",
                      isSelected ? "font-bold text-gray-900" : ""
                    )}
                    style={{
                      left: `calc(50% + ${x}px - 20px)`,
                      top: `calc(50% + ${y}px - 20px)`,
                      transform: isSelected ? 'scale(1.05)' : 'none'
                    }}
                    onClick={() => handleHourSelect(displayHour)}
                  >
                    {displayHour}
                  </button>
                );
              })}

              {/* Ponteiro do relógio */}
              <div 
                className="absolute w-1 bg-yellow-400 origin-bottom transition-all duration-300"
                style={{
                  height: hasSelection ? "90px" : "0px",
                  left: "50%",
                  top: hasSelection ? "calc(50% - 90px)" : "50%",
                  transform: hasSelection
                    ? `translateX(-50%) rotate(${pointerAngle}deg)`
                    : "translate(-50%, 0)",
                  opacity: hasSelection ? 1 : 0,
                  transformOrigin: "bottom center"
                }} 
              />
              
              {/* Centro do relógio */}
              <div className="absolute w-4 h-4 bg-yellow-400 rounded-full z-20 shadow-md" style={{
                left: "calc(50% - 8px)",
                top: "calc(50% - 8px)"
              }} />
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex space-x-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className={cn(
                isDarkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={onClose}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};