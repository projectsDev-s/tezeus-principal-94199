import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Edit, Trash2, RotateCcw } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { CriarTagModal } from "@/components/modals/CriarTagModal";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function CRMTags() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(false);
  
  const { selectedWorkspace } = useWorkspace();
  const { members: fetchedMembers, isLoading: loadingMembers } = useWorkspaceMembers(selectedWorkspace?.workspace_id || "");
  const members = fetchedMembers || [];
  const { tags, isLoading, error, refetch } = useTags(startDate, endDate, selectedUserId);

  const selectedUser = members.find(m => m.user_id === selectedUserId);

  const handleResetFilters = () => {
    setSelectedUserId("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Tags</h1>
          
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Popover open={isUserSelectorOpen} onOpenChange={setIsUserSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserSelectorOpen}
                    className="max-w-sm justify-between"
                    disabled={loadingMembers || members.length === 0}
                  >
                    {loadingMembers 
                      ? "Carregando..." 
                      : selectedUser?.user?.name || "Buscar usuário"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." />
                    <CommandEmpty>
                      {loadingMembers ? "Carregando usuários..." : "Nenhum usuário encontrado."}
                    </CommandEmpty>
                    <CommandGroup>
                      {members.length > 0 && members.map((member) => (
                        <CommandItem
                          key={member.id}
                          value={member.user?.name || ''}
                          onSelect={() => {
                            setSelectedUserId(member.user_id === selectedUserId ? "" : member.user_id);
                            setIsUserSelectorOpen(false);
                          }}
                        >
                          {member.user?.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: ptBR }) : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => startDate ? date < startDate : false}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Button 
              variant="outline" 
              size="icon"
              onClick={handleResetFilters}
              title="Restaurar filtros"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="yellow" 
              className="whitespace-nowrap"
              onClick={() => setIsCreateModalOpen(true)}
            >
              + Criar
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table style={{ fontSize: '12px' }}>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Contatos Tageados</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Carregando...</TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-red-600">{error}</TableCell>
                  </TableRow>
                ) : tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Nenhuma tag encontrada</TableCell>
                  </TableRow>
                ) : (
                  tags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Badge variant="secondary" style={{ backgroundColor: tag.color, color: 'white' }}>
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">0</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <CriarTagModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTagCreated={() => {
          refetch?.();
        }}
      />
    </div>
  );
}