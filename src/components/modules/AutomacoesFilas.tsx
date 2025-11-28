import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Search, Filter, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { toast } from "sonner";
import { AdicionarFilaModal } from "@/components/modals/AdicionarFilaModal";
import { EditarFilaModal } from "@/components/modals/EditarFilaModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

interface Fila {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  color?: string;
  order_position?: number;
  distribution_type?: string;
  ai_agent_id?: string;
  greeting_message?: string;
  workspace_id?: string;
  user_count?: number;
}

export function AutomacoesFilas() {
  const { selectedWorkspace } = useWorkspace();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFila, setSelectedFila] = useState<Fila | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadFilas = async () => {
    if (!selectedWorkspace?.workspace_id) return;

    try {
      // Buscar filas
      const { data: queuesData, error: queuesError } = await supabase
        .from('queues')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (queuesError) throw queuesError;

      // Buscar contagem de usuários para cada fila usando a edge function
      const filasComContagem = await Promise.all(
        (queuesData || []).map(async (fila) => {
          try {
            const { data: usersData, error: usersError } = await supabase.functions.invoke(
              'manage-queue-users',
              {
                body: { action: 'list', queueId: fila.id },
                headers: getWorkspaceHeaders(selectedWorkspace?.workspace_id),
              }
            );

            if (usersError) {
              console.error(`❌ Erro ao buscar usuários da fila ${fila.name}:`, usersError);
              return { ...fila, user_count: 0 };
            }

            const userCount = usersData?.users?.length || 0;
            return { ...fila, user_count: userCount };
          } catch (err) {
            console.error(`❌ Erro ao processar fila ${fila.name}:`, err);
            return { ...fila, user_count: 0 };
          }
        })
      );

      setFilas(filasComContagem);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
      toast.error('Erro ao carregar filas');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFila = async (filaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fila?')) return;

    try {
      const { error } = await supabase
        .from('queues')
        .delete()
        .eq('id', filaId);

      if (error) throw error;
      
      toast.success('Fila excluída com sucesso');
      loadFilas();
    } catch (error) {
      console.error('Erro ao excluir fila:', error);
      toast.error('Erro ao excluir fila');
    }
  };

  const handleEditFila = (fila: Fila) => {
    setSelectedFila(fila);
    setShowEditModal(true);
  };

  useEffect(() => {
    loadFilas();
  }, [selectedWorkspace?.workspace_id]);

  const filteredFilas = filas.filter(fila => 
    fila.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (fila.id && fila.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs">
      {/* Excel-like Toolbar (Ribbon) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa]">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-1 bg-primary text-primary-foreground h-8">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="font-semibold text-sm">Filas de Atendimento</span>
          </div>
          <div className="text-[10px] opacity-80">
            {loading ? "Carregando..." : `${filteredFilas.length} filas`}
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* Search Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3" />
              <Input
                placeholder="Pesquisar fila..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Nova Fila</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6]">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse bg-white text-xs font-sans">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 w-[80px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>ID</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>Nome</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Usuários</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[300px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Mensagem de Saudação</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[80px]">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr>
                  <td colSpan={5} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground">
                    Carregando filas...
                  </td>
                </tr>
              ) : filteredFilas.length === 0 ? (
                 <tr>
                  <td colSpan={5} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground">
                    Nenhuma fila encontrada.
                  </td>
                </tr>
              ) : (
                filteredFilas.map((fila) => (
                  <tr key={fila.id} className="hover:bg-blue-50 group h-[32px]">
                    <td className="border border-[#e0e0e0] px-2 py-0 font-mono text-[10px] align-middle text-muted-foreground">
                      {fila.id.substring(0, 8)}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 font-medium align-middle">
                      <div className="flex items-center">
                        <div 
                          className="w-2.5 h-2.5 rounded-full mr-2 border border-black/10" 
                          style={{ backgroundColor: fila.color || '#8B5CF6' }}
                        ></div>
                        {fila.name}
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle">
                      {fila.user_count || 0}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 max-w-[300px] truncate align-middle text-muted-foreground">
                      {fila.greeting_message || fila.description || '-'}
                    </td>
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center align-middle">
                      <div className="flex items-center justify-center gap-1 h-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditFila(fila)}
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFila(fila.id)}
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {/* Empty rows filler */}
              {!loading && filteredFilas.length > 0 && Array.from({ length: Math.max(0, 15 - filteredFilas.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-[32px]">
                   <td className="border border-[#e0e0e0]"></td>
                   <td className="border border-[#e0e0e0]"></td>
                   <td className="border border-[#e0e0e0]"></td>
                   <td className="border border-[#e0e0e0]"></td>
                   <td className="border border-[#e0e0e0] bg-gray-50"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Sheets (Categories) */}
      <div className="flex items-center border-t border-gray-300 bg-[#f0f0f0] px-1 h-8 select-none">
         <div className="flex items-end h-full gap-1 overflow-x-auto px-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-4 h-[26px] text-xs cursor-pointer border-t border-l border-r rounded-t-sm transition-all",
                "bg-white border-gray-300 border-b-white text-primary font-medium z-10 shadow-sm translate-y-[1px]"
              )}
            >
              <Layers className="h-3 w-3" />
              <span>Filas</span>
            </div>
         </div>
      </div>

      <AdicionarFilaModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={() => {
          setShowAddModal(false);
          loadFilas();
        }}
      />

      <EditarFilaModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        fila={selectedFila}
        onSuccess={() => {
          setShowEditModal(false);
          setSelectedFila(null);
          loadFilas();
        }}
      />
    </div>
  );
}
