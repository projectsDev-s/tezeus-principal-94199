import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { toast } from "sonner";
import { AdicionarFilaModal } from "@/components/modals/AdicionarFilaModal";
import { EditarFilaModal } from "@/components/modals/EditarFilaModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";

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
            console.log(`📊 Fila "${fila.name}" (${fila.id}): ${userCount} usuários`);
            return { ...fila, user_count: userCount };
          } catch (err) {
            console.error(`❌ Erro ao processar fila ${fila.name}:`, err);
            return { ...fila, user_count: 0 };
          }
        })
      );

      console.log('✅ Filas carregadas com contagem:', filasComContagem.map(f => ({ 
        name: f.name, 
        id: f.id.substring(0, 8), 
        user_count: f.user_count 
      })));
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
        <Button onClick={() => setShowAddModal(true)} variant="default">
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
              <TableHead>Mensagem de saudação</TableHead>
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
                  <TableCell>
                    {fila.user_count || 0}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {fila.greeting_message || fila.description || '-'}
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