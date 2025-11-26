import { useState } from 'react';
import { Filter, Plus, X, Calendar, User, Tag, MessageSquare, DollarSign, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function QueryBuilderSidebar() {
  const [filters, setFilters] = useState<any[]>([]);

  const addFilter = (type: string) => {
    setFilters([...filters, { type, operator: 'equals', value: '' }]);
  };

  const removeFilter = (index: number) => {
    const newFilters = [...filters];
    newFilters.splice(index, 1);
    setFilters(newFilters);
  };

  const filterTypes = [
    { id: 'date', label: 'Data', icon: Calendar },
    { id: 'status', label: 'Status', icon: Activity },
    { id: 'pipeline', label: 'Pipeline', icon: Filter },
    { id: 'team', label: 'Equipe', icon: User },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'value', label: 'Valor', icon: DollarSign },
  ];

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros Avançados
        </h3>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {filters.map((filter, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg space-y-2 relative group">
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFilter(index)}
              >
                <X className="h-3 w-3" />
              </Button>
              
              <div className="font-medium text-sm flex items-center gap-2">
                {filterTypes.find(t => t.id === filter.type)?.label || filter.type}
              </div>

              <Select defaultValue={filter.operator}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="greater">Maior que</SelectItem>
                  <SelectItem value="less">Menor que</SelectItem>
                </SelectContent>
              </Select>

              <Input className="h-8" placeholder="Valor..." />
            </div>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Filtro
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              <div className="grid gap-1">
                {filterTypes.map((type) => (
                  <Button
                    key={type.id}
                    variant="ghost"
                    className="justify-start font-normal"
                    onClick={() => addFilter(type.id)}
                  >
                    <type.icon className="mr-2 h-4 w-4" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full">Aplicar Filtros</Button>
        <Button variant="outline" className="w-full" onClick={() => setFilters([])}>
          Limpar Todos
        </Button>
      </div>
    </div>
  );
}


