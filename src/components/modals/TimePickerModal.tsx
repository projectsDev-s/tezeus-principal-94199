import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeSelect: (hour: number) => void;
  isDarkMode?: boolean;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isOpen,
  onClose,
  onTimeSelect,
  isDarkMode = false,
}) => {
  const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = React.useState<number | null>(null);
  const hours = Array.from({ length: 12 }, (_, i) => i);

  const handleHourSelect = (hour: number) => {
    const displayHour = hour === 0 ? 12 : hour;
    setSelectedHour(displayHour);
    // Converter para formato 24h
    const hour24 = period === 'PM' && displayHour !== 12 ? displayHour + 12 : displayHour === 12 && period === 'AM' ? 0 : displayHour;
    onTimeSelect(hour24);
  };

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
                const isSelected = selectedHour === displayHour;
                
                return (
                  <button
                    key={hour}
                    className={cn(
                      "absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all z-10",
                      isSelected 
                        ? "bg-yellow-400 text-gray-900 scale-110 shadow-lg" 
                        : isDarkMode 
                          ? "text-gray-400 hover:text-gray-200" 
                          : "text-gray-600 hover:text-gray-900"
                    )}
                    style={{
                      left: `calc(50% + ${x}px - 20px)`,
                      top: `calc(50% + ${y}px - 20px)`,
                    }}
                    onClick={() => handleHourSelect(displayHour)}
                  >
                    {displayHour}
                  </button>
                );
              })}

              {/* Ponteiro do relógio */}
              {selectedHour !== null && (
                <div 
                  className="absolute w-1 bg-yellow-400 origin-bottom transition-all duration-300"
                  style={{
                    height: "90px",
                    left: "50%",
                    top: "calc(50% - 90px)",
                    transform: `translateX(-50%) rotate(${(selectedHour * 30) - 90}deg)`,
                    transformOrigin: "bottom center"
                  }} 
                />
              )}
              
              {/* Centro do relógio */}
              <div className="absolute w-4 h-4 bg-yellow-400 rounded-full z-20 shadow-md" style={{
                left: "calc(50% - 8px)",
                top: "calc(50% - 8px)"
              }} />

              {/* Minutos 00 no topo */}
              <div 
                className={cn(
                  "absolute text-xs font-medium",
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                )}
                style={{
                  left: "calc(50% - 10px)",
                  top: "20px"
                }}
              >
                00
              </div>
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