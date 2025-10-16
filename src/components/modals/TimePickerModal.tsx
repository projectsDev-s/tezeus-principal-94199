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
  const hours = Array.from({ length: 12 }, (_, i) => i);

  const handleHourSelect = (hour: number) => {
    // Converter para formato 24h
    const hour24 = period === 'PM' && hour !== 12 ? hour + 12 : hour === 12 && period === 'AM' ? 0 : hour;
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
              🌅 AM (Manhã)
            </Button>
            <Button
              variant={period === 'PM' ? 'default' : 'outline'}
              onClick={() => setPeriod('PM')}
              className={cn(
                "px-6",
                period === 'PM' 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : isDarkMode ? "text-gray-300 border-gray-600" : "text-gray-700"
              )}
            >
              🌙 PM (Noite)
            </Button>
          </div>

          {/* Relógio Visual */}
          <div className="relative w-64 h-64">
            <div className={cn(
              "w-full h-full rounded-full border-2 flex items-center justify-center relative",
              period === 'AM' 
                ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300" 
                : "bg-gradient-to-br from-indigo-900 to-indigo-950 border-indigo-600",
              isDarkMode && period === 'PM' && "from-indigo-950 to-gray-900"
            )}>
              {/* Números das horas */}
              {hours.map((hour) => {
                const displayHour = hour === 0 ? 12 : hour;
                const angle = (displayHour * 30) - 90; // 360/12 = 30 graus por hora, -90 para começar no topo
                const radius = 90;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                
                return (
                  <button
                    key={hour}
                    className={cn(
                      "absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all shadow-sm",
                      period === 'AM' 
                        ? "bg-white text-blue-700 hover:bg-blue-500 hover:text-white border border-blue-200" 
                        : "bg-indigo-800 text-indigo-100 hover:bg-indigo-500 hover:text-white border border-indigo-600"
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
              
              {/* Centro do relógio */}
              <div className={cn(
                "absolute w-4 h-4 rounded-full shadow-lg",
                period === 'AM' ? "bg-blue-500" : "bg-indigo-400"
              )} style={{
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