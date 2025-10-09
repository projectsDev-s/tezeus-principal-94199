import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters?: (filters: FilterData) => void;
}

interface FilterData {
  tags: string[];
  selectedDate?: Date;
  dateRange?: { from: Date; to: Date };
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function FilterModal({ open, onOpenChange, onApplyFilters }: FilterModalProps) {
  const { tags: availableTags, isLoading: tagsLoading } = useTags();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [showCalendar, setShowCalendar] = useState(false);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };


  const handleClear = () => {
    setSelectedTags([]);
    setSelectedDate(undefined);
    setDateRange(undefined);
    
    // Limpar filtros aplicados também
    if (onApplyFilters) {
      onApplyFilters({
        tags: [],
        selectedDate: undefined,
        dateRange: undefined
      });
    }
  };

  const handleApply = () => {
    const filterData: FilterData = {
      tags: selectedTags,
      selectedDate,
      dateRange
    };
    
    if (onApplyFilters) {
      onApplyFilters(filterData);
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Selecionar tags */}
          <div>
            <Label htmlFor="tags" className="text-sm font-medium">
              Selecionar tags
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1"
                  disabled={tagsLoading}
                >
                  {tagsLoading ? (
                    <span className="text-muted-foreground">Carregando tags...</span>
                  ) : selectedTags.length === 0 ? (
                    <span className="text-muted-foreground">Selecionar tags</span>
                  ) : (
                    <span>{selectedTags.length} tag(s) selecionada(s)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="max-h-60 overflow-y-auto p-2">
                  {tagsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Carregando tags...
                    </div>
                  ) : availableTags.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Nenhuma tag encontrada
                    </div>
                  ) : (
                    availableTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => toggleTag(tag.id)}
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm">{tag.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Seleção de data */}
          <div>
            <Label htmlFor="date-filter" className="text-sm font-medium">
              Filtrar por data
            </Label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "dd/MM/yyyy")
                  ) : dateRange ? (
                    `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                  ) : (
                    "Selecionar data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange || (selectedDate ? { from: selectedDate, to: selectedDate } : undefined)}
                  onSelect={(range) => {
                    if (range) {
                      if (range.from && range.to) {
                        // Período completo selecionado
                        if (range.from.getTime() !== range.to.getTime()) {
                          setDateRange({ from: range.from, to: range.to });
                          setSelectedDate(undefined);
                        } else {
                          // Mesma data selecionada duas vezes = data única
                          setSelectedDate(range.from);
                          setDateRange(undefined);
                        }
                        // Não fecha mais automaticamente - só ao clicar fora
                      } else if (range.from) {
                        // Apenas primeira data selecionada - manter calendário aberto
                        setDateRange({ from: range.from, to: range.from });
                        setSelectedDate(undefined);
                      }
                    } else {
                      setSelectedDate(undefined);
                      setDateRange(undefined);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="ghost" onClick={handleClear}>
              Limpar
            </Button>
            <Button 
              onClick={handleApply}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}