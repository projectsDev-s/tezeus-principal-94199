import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MinutePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinuteSelect: (minute: number) => void;
  selectedMinute?: number | null;
  isDarkMode?: boolean;
}

export const MinutePickerModal: React.FC<MinutePickerModalProps> = ({
  isOpen,
  onClose,
  onMinuteSelect,
  selectedMinute = null,
  isDarkMode = false,
}) => {
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, 15, ..., 55
  const [currentMinute, setCurrentMinute] = React.useState<number | null>(selectedMinute);

  React.useEffect(() => {
    if (isOpen) {
      setCurrentMinute(selectedMinute ?? null);
    }
  }, [isOpen, selectedMinute]);

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
            Selecionar Minutos
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 p-4">
          {/* Relógio Visual para Minutos */}
          <div className="relative w-64 h-64">
            <div className={cn(
              "w-full h-full rounded-full border-2 flex items-center justify-center relative",
              isDarkMode ? "bg-gray-800 border-gray-600" : "bg-gray-100 border-gray-300"
            )}>
              {/* Números dos minutos */}
              {minutes.map((minute, index) => {
                const angle = (index * 30) - 90; // 360/12 = 30 graus por posição, -90 para começar no topo
                const radius = 90;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                const isSelected = currentMinute === minute;
                
                return (
                  <button
                    key={minute}
                    className={cn(
                      "absolute w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-transform",
                      isDarkMode ? "text-gray-300 hover:text-black" : "text-gray-700 hover:text-black",
                      isSelected ? "font-semibold text-gray-900" : ""
                    )}
                    style={{
                      left: `calc(50% + ${x}px - 16px)`,
                      top: `calc(50% + ${y}px - 16px)`,
                      transform: isSelected ? 'scale(1.05)' : 'none'
                    }}
                    onClick={() => {
                      setCurrentMinute(minute);
                      onMinuteSelect(minute);
                    }}
                  >
                    {minute.toString().padStart(2, '0')}
                  </button>
                );
              })}
              
              {/* Ponteiro do relógio */}
          <div
            className={cn(
              "absolute w-1 origin-bottom transition-transform duration-300",
              currentMinute !== null ? "bg-yellow-400" : "bg-transparent"
            )}
            style={{
              height: "60px",
              left: "50%",
              top: "calc(50% - 60px)",
              transform: `translateX(-50%) rotate(${(currentMinute ?? 0) * 6 - 90}deg)`
            }}
          />
              
              {/* Centro do relógio */}
              <div className="absolute w-3 h-3 bg-yellow-400 rounded-full" style={{
                left: "calc(50% - 6px)",
                top: "calc(50% - 6px)"
              }} />
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex space-x-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className={cn(
                "text-yellow-500 hover:text-yellow-600",
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={onClose}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};