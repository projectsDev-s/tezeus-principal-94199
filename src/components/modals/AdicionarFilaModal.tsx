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
import { Palette, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface AdicionarFilaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
interface AIAgent {
  id: string;
  name: string;
  is_active: boolean;
}
const distributionOptions = [{
  value: "aleatoria",
  label: "Aleatória"
}, {
  value: "sequencial",
  label: "Sequencial"
}, {
  value: "ordenada",
  label: "Ordenada"
}, {
  value: "nao_distribuir",
  label: "Não distribuir"
}];
const colors = ["#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#F97316", "#EC4899", "#6366F1", "#84CC16", "#06B6D4"];
export function AdicionarFilaModal({
  open,
  onOpenChange,
  onSuccess
}: AdicionarFilaModalProps) {
  const { selectedWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [showError, setShowError] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#8B5CF6");
  const [ordem, setOrdem] = useState("");
  const [distribuicao, setDistribuicao] = useState("");
  const [agenteId, setAgenteId] = useState("");
  const [mensagemSaudacao, setMensagemSaudacao] = useState("");
  const loadAIAgents = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('ai_agents').select('id, name, is_active').eq('is_active', true).order('name');
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
    setShowError(false);
  };
  const handleSubmit = async () => {
    if (!nome.trim()) {
      setShowError(true);
      toast.error("Nome é obrigatório");
      return;
    }

    if (!selectedWorkspace?.workspace_id) {
      toast.error("Nenhum workspace selecionado");
      return;
    }

    setShowError(false);
    setLoading(true);
    try {
      const {
        error
      } = await supabase.from('queues').insert({
        name: nome.trim(),
        description: mensagemSaudacao.trim() || null,
        color: cor,
        order_position: ordem ? parseInt(ordem) : 0,
        distribution_type: distribuicao || 'aleatoria',
        ai_agent_id: agenteId || null,
        greeting_message: mensagemSaudacao.trim() || null,
        workspace_id: selectedWorkspace.workspace_id,
        is_active: true
      });
      if (error) throw error;
      toast.success("Fila criada com sucesso!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar fila:', error);
      toast.error("Erro ao criar fila");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (open) {
      loadAIAgents();
    } else {
      resetForm();
    }
  }, [open]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar fila</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados" className="text-yellow-600 data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800">
              DADOS DA FILA
            </TabsTrigger>
            <TabsTrigger value="usuarios">USUÁRIOS DA FILA</TabsTrigger>
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
                  onChange={(e) => {
                    setNome(e.target.value);
                    setShowError(false);
                  }} 
                  placeholder="Nome da fila" 
                  className={showError ? "border-red-500 focus:border-red-500" : ""} 
                />
                {showError && <span className="text-xs text-red-500">Nome é obrigatório</span>}
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <div className="w-4 h-4 rounded mr-2" style={{
                      backgroundColor: cor
                    }} />
                      <Palette className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="grid grid-cols-5 gap-2">
                      {colors.map(color => <button key={color} className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400" style={{
                      backgroundColor: color
                    }} onClick={() => setCor(color)} />)}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem da fila (Bot)</Label>
                <Input id="ordem" value={ordem} onChange={e => setOrdem(e.target.value)} placeholder="Ordem da fila" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Distribuição automática</Label>
              <Select value={distribuicao} onValueChange={setDistribuicao}>
                <SelectTrigger className="w-full bg-yellow-50 border-yellow-200">
                  <SelectValue placeholder="Selecione a distribuição automática" />
                </SelectTrigger>
                <SelectContent>
                  {distributionOptions.map(option => <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>DS Agente</Label>
              <Select value={agenteId} onValueChange={setAgenteId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um agente" />
                  
                </SelectTrigger>
                <SelectContent>
                  {aiAgents.map(agent => <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem de saudação</Label>
              <Textarea id="mensagem" value={mensagemSaudacao} onChange={e => setMensagemSaudacao(e.target.value)} placeholder="Digite a mensagem de saudação..." rows={6} className="resize-none" />
            </div>
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-4 mt-6">
            <div className="text-center py-12 text-muted-foreground">
              <p>Configuração de usuários da fila em desenvolvimento...</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Opções
            <Button variant="ghost" size="sm" className="ml-2 text-yellow-600">
              + Adicionar
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !nome.trim()} className="bg-yellow-500 hover:bg-yellow-600 text-black">
              {loading ? "Criando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}