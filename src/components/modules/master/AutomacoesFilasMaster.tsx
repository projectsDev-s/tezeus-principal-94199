import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdicionarFilaModal } from "../../modals/AdicionarFilaModal";
import { EditarFilaModal } from "../../modals/EditarFilaModal";

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
  workspace_name?: string;
}

export function AutomacoesFilasMaster() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFila, setSelectedFila] = useState<Fila | null>(null);

  const loadFilas = async () => {
    try {
      const { data, error } = await supabase
        .from('queues')
        .select(`
          id,
          name,
          description,
          is_active,
          created_at,
          updated_at,
          color,
          order_position,
          distribution_type,
          ai_agent_id,
          greeting_message,
          workspace_id,
          workspaces!inner (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const filasComWorkspace = (data || []).map((fila: any) => ({
        id: fila.id,
        name: fila.name,
        description: fila.description,
        is_active: fila.is_active,
        created_at: fila.created_at,
        updated_at: fila.updated_at,
        color: fila.color,
        order_position: fila.order_position,
        distribution_type: fila.distribution_type,
        ai_agent_id: fila.ai_agent_id,
        greeting_message: fila.greeting_message,
        workspace_id: fila.workspace_id,
        workspace_name: fila.workspaces?.name || 'Sem empresa'
      }));
      
      setFilas(filasComWorkspace);
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
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Filas</h1>
        <Button onClick={() => setShowAddModal(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar fila
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <p className="text-lg mb-2">Nenhuma fila encontrada</p>
                    <p>Clique em "Adicionar fila" para criar sua primeira fila.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell className="font-mono text-sm">{fila.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: fila.color || '#8B5CF6' }}
                      ></div>
                      {fila.name}
                    </div>
                  </TableCell>
                  <TableCell>1</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {fila.workspace_name || 'Sem empresa'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditFila(fila)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFila(fila.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
