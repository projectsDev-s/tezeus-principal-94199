import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Edit, Trash2, RotateCcw, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { selectedWorkspace } = useWorkspace();
  const { members: fetchedMembers, isLoading: loadingMembers } = useWorkspaceMembers(selectedWorkspace?.workspace_id || "");
  const members = fetchedMembers || [];
  const { tags, isLoading, error, refetch } = useTags(startDate, endDate, selectedUserId);

  const selectedUser = members.find(m => m.user_id === selectedUserId);
  
  const filteredMembers = members.filter(member => 
    member.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleResetFilters = () => {
    setSelectedUserId("");
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchTerm("");
  };
  
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsDropdownOpen(false);
    setSearchTerm("");
  };
  
  const handleClearUser = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUserId("");
    setSearchTerm("");
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Tags</h1>
          
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative" ref={dropdownRef}>
              <div className="relative max-w-sm">
                <Input
                  type="text"
                  placeholder={loadingMembers ? "Carregando..." : selectedUser?.user?.name || "Buscar usuário"}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={() => setIsDropdownOpen(true)}
                  disabled={loadingMembers}
                  className="pr-8"
                />
                {selectedUser && (
                  <button
                    onClick={handleClearUser}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {isDropdownOpen && !loadingMembers && (
                <div className="absolute top-full left-0 mt-1 w-full max-w-sm bg-background border rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum usuário encontrado
                    </div>
                  ) : (
                    filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => handleSelectUser(member.user_id)}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                      >
                        {member.user?.name}
                      </div>
                    ))
                  )}
                </div>
              )}
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