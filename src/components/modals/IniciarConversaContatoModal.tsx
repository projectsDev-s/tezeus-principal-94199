import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigate } from "react-router-dom";

interface IniciarConversaContatoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  contactPhone: string;
}

interface Queue {
  id: string;
  name: string;
  color: string;
}

interface Connection {
  id: string;
  instance_name: string;
  phone_number: string;
  status: string;
}

export function IniciarConversaContatoModal({ 
  open, 
  onOpenChange, 
  contactId,
  contactName,
  contactPhone 
}: IniciarConversaContatoModalProps) {
  const { selectedWorkspace } = useWorkspace();
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [queues, setQueues] = useState<Queue[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Carregar filas
  useEffect(() => {
    const fetchQueues = async () => {
      if (!selectedWorkspace) return;

      try {
        const { data, error } = await supabase
          .from('queues')
          .select('id, name, color')
          .eq('workspace_id', selectedWorkspace.workspace_id)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setQueues(data || []);
      } catch (error) {
        console.error('Erro ao carregar filas:', error);
      }
    };

    if (open) {
      fetchQueues();
    }
  }, [open, selectedWorkspace]);

  // Carregar conexões
  useEffect(() => {
    const fetchConnections = async () => {
      if (!selectedWorkspace) return;

      try {
        const { data, error } = await supabase
          .from('connections')
          .select('id, instance_name, phone_number, status')
          .eq('workspace_id', selectedWorkspace.workspace_id)
          .eq('status', 'connected')
          .order('instance_name');

        if (error) throw error;
        setConnections(data || []);
        
        // Selecionar primeira conexão por padrão
        if (data && data.length > 0) {
          setSelectedConnection(data[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar conexões:', error);
      }
    };

    if (open) {
      fetchConnections();
    }
  }, [open, selectedWorkspace]);

  const handleIniciar = async () => {
    if (!selectedConnection) {
      toast({
        title: "Atenção",
        description: "Selecione um canal de atendimento.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Verificar se já existe uma conversa aberta com este contato
      const { data: existingConversation, error: checkError } = await supabase
        .from('conversations')
        .select('id, status')
        .eq('contact_id', contactId)
        .eq('workspace_id', selectedWorkspace!.workspace_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkError) throw checkError;

      let conversationId;

      if (existingConversation && existingConversation.status === 'open') {
        // Conversa já existe e está aberta
        conversationId = existingConversation.id;
        
        // Atualizar fila se selecionada
        if (selectedQueue) {
          await supabase
            .from('conversations')
            .update({ 
              queue_id: selectedQueue,
              last_activity_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        }

        toast({
          title: "Conversa encontrada",
          description: "Redirecionando para a conversa existente.",
        });
      } else {
        // Criar nova conversa
        const connectionData = connections.find(c => c.id === selectedConnection);
        
        const { data: newConversation, error: conversationError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            connection_id: selectedConnection,
            evolution_instance: connectionData?.instance_name,
            queue_id: selectedQueue || null,
            canal: 'whatsapp',
            status: 'open',
            agente_ativo: false,
            last_activity_at: new Date().toISOString(),
            workspace_id: selectedWorkspace!.workspace_id
          })
          .select()
          .single();

        if (conversationError) throw conversationError;
        conversationId = newConversation.id;

        toast({
          title: "Conversa iniciada",
          description: "Nova conversa criada com sucesso!",
        });
      }

      // Redirecionar para a aba Conversas com a conversa selecionada
      navigate('/conversas', { 
        state: { selectedConversationId: conversationId } 
      });

      handleClose();
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conversa. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedQueue("");
    setSelectedConnection("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contato</Label>
            <div className="p-3 bg-muted rounded-md">
              <div className="font-medium">{contactName}</div>
              <div className="text-sm text-muted-foreground">{contactPhone}</div>
            </div>
          </div>

          {/* Seleção de Fila */}
          <div className="space-y-2">
            <Label htmlFor="queue">Fila (opcional)</Label>
            <Select value={selectedQueue} onValueChange={setSelectedQueue}>
              <SelectTrigger id="queue">
                <SelectValue placeholder="Selecione uma fila" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem fila</SelectItem>
                {queues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: queue.color }}
                      />
                      {queue.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Canal */}
          <div className="space-y-2">
            <Label htmlFor="connection">Selecione um Canal de Atendimento</Label>
            <Select value={selectedConnection} onValueChange={setSelectedConnection}>
              <SelectTrigger id="connection">
                <SelectValue placeholder="Selecione um Canal de Atendimento" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    <div className="flex items-center gap-2">
                      {connection.instance_name} {connection.phone_number && `(${connection.phone_number})`}
                      <span className="text-xs text-green-500 font-semibold">CONNECTED</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleIniciar} 
            disabled={loading || !selectedConnection}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? "Iniciando..." : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
