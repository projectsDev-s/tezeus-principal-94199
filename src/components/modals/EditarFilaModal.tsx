import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Palette, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQueueUsers } from "@/hooks/useQueueUsers";
import { AdicionarUsuarioFilaModal } from "./AdicionarUsuarioFilaModal";
import { QueueUsersList } from "./QueueUsersList";

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
}

interface EditarFilaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: Fila | null;
  onSuccess: () => void;
}

interface AIAgent {
  id: string;
  name: string;
  is_active: boolean;
}

const distributionOptions = [
  { value: "sequencial", label: "Sequencial" },
  { value: "nao_distribuir", label: "Não distribuir" }
];

const colors = [
  "#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", 
  "#F97316", "#EC4899", "#6366F1", "#84CC16", "#06B6D4"
];

export function EditarFilaModal({ open, onOpenChange, fila, onSuccess }: EditarFilaModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
  // Form state
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#8B5CF6");
  const [ordem, setOrdem] = useState("");
  const [distribuicao, setDistribuicao] = useState("");
  const [agenteId, setAgenteId] = useState("");
  const [mensagemSaudacao, setMensagemSaudacao] = useState("");

  const {
    users: queueUsers,
    loading: loadingUsers,
    loadQueueUsers,
    addUsersToQueue,
    removeUserFromQueue,
  } = useQueueUsers(fila?.id);

  const loadAIAgents = async () => {
    if (!fila?.workspace_id) return;
    
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('is_active', true)
        .eq('workspace_id', fila.workspace_id)
        .order('name');

      if (error) throw error;
      setAiAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    }
  };

  const resetForm = () => {
    setNome("");
    setCor("#8B5CF6");
    setOrdem("");
    setDistribuicao("");
    setAgenteId("");
    setMensagemSaudacao("");
    setActiveTab("dados");
  };

  const loadFilaData = () => {
    if (fila) {
      setNome(fila.name);
      setCor(fila.color || "#8B5CF6");
      setOrdem(fila.order_position?.toString() || "");
      setDistribuicao(fila.distribution_type || "");
      setAgenteId(fila.ai_agent_id || "");
      setMensagemSaudacao(fila.greeting_message || "");
    }
  };

  const handleSubmit = async () => {
    if (!nome.trim() || !fila) {
      toast.error("Nome é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('queues')
        .update({
          name: nome.trim(),
          description: mensagemSaudacao.trim() || null,
          color: cor,
          order_position: ordem ? parseInt(ordem) : 0,
          distribution_type: distribuicao || 'aleatoria',
          ai_agent_id: agenteId || null,
          greeting_message: mensagemSaudacao.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', fila.id);

      if (error) throw error;

      toast.success("Fila atualizada com sucesso!");
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar fila:', error);
      toast.error("Erro ao atualizar fila");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAIAgents();
      if (fila) {
        loadFilaData();
        loadQueueUsers();
      }
    } else {
      resetForm();
    }
  }, [open, fila]);

  // Carregar usuários sempre que a aba de usuários for aberta
  useEffect(() => {
    if (open && activeTab === "usuarios" && fila?.id) {
      loadQueueUsers();
    }
  }, [activeTab, open, fila?.id]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar fila</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">
                Dados da Fila
              </TabsTrigger>
              <TabsTrigger value="usuarios">Usuários da Fila</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">
                    Nome <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome da fila"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <div 
                          className="w-4 h-4 rounded mr-2"
                          style={{ backgroundColor: cor }}
                        />
                        <Palette className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="grid grid-cols-5 gap-2">
                        {colors.map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400"
                            style={{ backgroundColor: color }}
                            onClick={() => setCor(color)}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

              </div>

              <div className="space-y-2">
                <Label>Distribuição automática</Label>
                <Select value={distribuicao} onValueChange={setDistribuicao}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a distribuição automática" />
                  </SelectTrigger>
                  <SelectContent>
                    {distributionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Agentes de IA</Label>
                <Select value={agenteId} onValueChange={setAgenteId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um agente" />
                    <ChevronDown className="w-4 h-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {aiAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem de saudação</Label>
                <Textarea
                  id="mensagem"
                  value={mensagemSaudacao}
                  onChange={(e) => setMensagemSaudacao(e.target.value)}
                  placeholder="Digite a mensagem de saudação..."
                  rows={6}
                  className="resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="usuarios" className="space-y-4 mt-6">
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowAddUserModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar usuário à fila
                </Button>
              </div>

              <QueueUsersList 
                users={queueUsers}
                loading={loadingUsers}
                onRemoveUser={removeUserFromQueue}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading || !nome.trim()}
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AdicionarUsuarioFilaModal
        open={showAddUserModal}
        onOpenChange={setShowAddUserModal}
        onAddUsers={addUsersToQueue}
        excludeUserIds={queueUsers.map(qu => qu.user_id)}
      />
    </>
  );
}
