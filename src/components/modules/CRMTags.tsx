import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Edit, Trash2, RotateCcw, X, Tag, Search, Plus, Filter, User } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { CriarTagModal } from "@/components/modals/CriarTagModal";
import { EditarTagModal } from "@/components/modals/EditarTagModal";
import { DeletarTagModal } from "@/components/modals/DeletarTagModal";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";

export function CRMTags() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<{ id: string; name: string; color: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { selectedWorkspace } = useWorkspace();
  const { userRole } = useAuth();
  
  const shouldFetchMembers = userRole === 'admin' || userRole === 'master';
  const { members: fetchedMembers, isLoading: loadingMembers } = useWorkspaceMembers(
    shouldFetchMembers ? (selectedWorkspace?.workspace_id || "") : ""
  );
  const members = fetchedMembers || [];
  const { tags, isLoading, error, refetch } = useTags(selectedWorkspace?.workspace_id, startDate, endDate, selectedUserId);

  const selectedUser = members.find(m => m.user_id === selectedUserId);
  
  // Filtrar usuários master e aplicar busca por nome
  const filteredMembers = members
    .filter(member => member.role !== 'master')
    .filter(member => 
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
  
  const handleEditTag = (tag: { id: string; name: string; color: string }) => {
    setSelectedTag(tag);
    setIsEditModalOpen(true);
  };
  
  const handleDeleteTag = (tag: { id: string; name: string; color: string }) => {
    setSelectedTag(tag);
    setIsDeleteModalOpen(true);
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
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs">
      {/* Excel-like Toolbar (Ribbonish) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa]">
        {/* Title Bar / Top Menu */}
        <div className="flex items-center justify-between px-4 py-1 bg-primary text-primary-foreground h-8">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="font-semibold">Tags</span>
          </div>
          <div className="text-[10px] opacity-80">
            {isLoading ? "Carregando..." : `${tags.length} registros`}
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* User Filter Group (Admin only) */}
          {(userRole === 'admin' || userRole === 'master') && (
            <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1 relative" ref={dropdownRef}>
              <div className="relative w-48">
                <User className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3" />
                <Input
                  placeholder={loadingMembers ? "Carregando..." : (selectedUser?.user?.name || "Filtrar por usuário...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={() => setIsDropdownOpen(true)}
                  disabled={loadingMembers}
                  className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                {selectedUser && (
                  <button
                    onClick={handleClearUser}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              
              {isDropdownOpen && !loadingMembers && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded-sm shadow-lg z-50 max-h-[300px] overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500 text-center">
                      Nenhum usuário encontrado
                    </div>
                  ) : (
                    filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => handleSelectUser(member.user_id)}
                        className="px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        {member.user?.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date Filters Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-7 px-2 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 justify-start text-left font-normal w-[130px]",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
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
                    "h-7 px-2 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 justify-start text-left font-normal w-[130px]",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
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

            {(startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                onClick={handleResetFilters}
                title="Limpar filtros"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Nova Tag</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Excel Grid Table */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6]">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse bg-white text-xs font-sans">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>Nome</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Contatos Tageados</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-[#e0e0e0] px-2 py-1">
                        <div className="h-4 w-32 bg-gray-100 animate-pulse rounded-sm" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center">
                        <div className="h-4 w-16 bg-gray-100 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center">
                        <div className="h-4 w-16 bg-gray-100 animate-pulse rounded-sm mx-auto" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="border border-[#e0e0e0] text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-[#e0e0e0] text-center py-12 bg-gray-50">
                    <div className="flex flex-col items-center gap-2">
                      <Tag className="h-8 w-8 text-gray-300" />
                      <p className="text-gray-500 font-medium">
                        Nenhuma tag encontrada
                      </p>
                      <Button
                        size="sm"
                        className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs rounded-sm"
                        onClick={() => setIsCreateModalOpen(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Criar primeira tag
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-blue-50 group h-[32px]">
                    {/* Name */}
                    <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap">
                      <Badge 
                        variant="outline" 
                        style={{ 
                          backgroundColor: `${tag.color}15`,
                          borderColor: tag.color,
                          color: tag.color
                        }}
                        className="text-[10px] px-2 py-0 h-5 rounded-full font-medium border"
                      >
                        {tag.name}
                      </Badge>
                    </td>

                    {/* Count */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center text-gray-600 whitespace-nowrap">
                      {tag.contact_count || 0}
                    </td>

                    {/* Actions */}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center">
                      <div className="flex items-center justify-center gap-0.5 h-full">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600"
                          onClick={() => handleEditTag(tag)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600"
                          onClick={() => handleDeleteTag(tag)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {/* Empty rows to fill space like Excel */}
               {tags.length > 0 && Array.from({ length: Math.max(0, 20 - tags.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-[32px]">
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0]"></td>
                     <td className="border border-[#e0e0e0] bg-gray-50"></td>
                  </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      <CriarTagModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTagCreated={() => {
          refetch?.();
        }}
      />

      <EditarTagModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTag(null);
        }}
        onTagUpdated={() => {
          refetch?.();
        }}
        tag={selectedTag}
      />

      <DeletarTagModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedTag(null);
        }}
        onTagDeleted={() => {
          refetch?.();
        }}
        tag={selectedTag}
      />
    </div>
  );
}