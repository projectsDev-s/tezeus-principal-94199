import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Bot, Eye, EyeOff, Upload, X, FileText, Plus, Info, RotateCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Card, CardContent } from "@/components/ui/card";

interface CriarAgenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated?: () => void;
}

export function CriarAgenteModal({
  open,
  onOpenChange,
  onAgentCreated
}: CriarAgenteModalProps) {
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { workspaces, isLoading: loadingWorkspaces } = useWorkspaces();

  const [formData, setFormData] = useState({
    name: '',
    agent_type: 'OPENAI_COMPLETION',
    api_key: '',
    model: 'gpt-4o',
    system_instructions: '',
    google_sheets_links: [] as string[],
    knowledge_files: [] as File[],
    enable_scheduling: false,
    temperature: 0.3,
    max_tokens: 2000,
    max_messages_history: 300,
    delay_to_receive: 3,
    ignore_messages_until: 0,
    reply_old_tickets: false,
    split_messages: true,
    process_images: false,
    disable_when_answer: false,
    workspace_id: '',
  });

  const [newSheetLink, setNewSheetLink] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{role: string, content: string}>>([]);

  const handleAddSheetLink = () => {
    if (newSheetLink.trim()) {
      setFormData({
        ...formData,
        google_sheets_links: [...formData.google_sheets_links, newSheetLink]
      });
      setNewSheetLink('');
    }
  };

  const handleRemoveSheetLink = (index: number) => {
    setFormData({
      ...formData,
      google_sheets_links: formData.google_sheets_links.filter((_, i) => i !== index)
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setFormData({
        ...formData,
        knowledge_files: [...formData.knowledge_files, ...Array.from(files)]
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setFormData({
      ...formData,
      knowledge_files: formData.knowledge_files.filter((_, i) => i !== index)
    });
  };

  const handleSendTestMessage = () => {
    if (testMessage.trim()) {
      setTestMessages([
        ...testMessages,
        { role: 'user', content: testMessage }
      ]);
      setTestMessage('');
      
      // Simular resposta do agente
      setTimeout(() => {
        setTestMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Resposta simulada do agente. Configure o agente completamente para testes reais.' }
        ]);
      }, 1000);
    }
  };

  const handleResetTest = () => {
    setTestMessages([]);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    if (!formData.api_key.trim()) {
      toast.error('API Key é obrigatória');
      return;
    }

    if (!formData.system_instructions.trim()) {
      toast.error('Instruções do sistema são obrigatórias');
      return;
    }

    if (!formData.workspace_id) {
      toast.error('Selecione uma empresa');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('ai_agents')
        .insert([{
          name: formData.name,
          agent_type: formData.agent_type,
          api_key_encrypted: formData.api_key,
          model: formData.model,
          system_instructions: formData.system_instructions,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          response_delay_ms: formData.delay_to_receive * 1000,
          is_active: true,
          workspace_id: formData.workspace_id,
          api_provider: 'openai',
          auto_responses_enabled: true,
          working_hours_enabled: false,
          working_days: [1, 2, 3, 4, 5],
          fallback_message: 'Desculpe, não estou disponível no momento.',
          knowledge_base_enabled: formData.knowledge_files.length > 0,
        }]);

      if (error) throw error;
      
      toast.success('Agente criado com sucesso!');
      onAgentCreated?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        agent_type: 'OPENAI_COMPLETION',
        api_key: '',
        model: 'gpt-4o',
        system_instructions: '',
        google_sheets_links: [],
        knowledge_files: [],
        enable_scheduling: false,
        temperature: 0.3,
        max_tokens: 2000,
        max_messages_history: 300,
        delay_to_receive: 3,
        ignore_messages_until: 0,
        reply_old_tickets: false,
        split_messages: true,
        process_images: false,
        disable_when_answer: false,
        workspace_id: '',
      });
    } catch (error) {
      console.error('Erro ao criar agente:', error);
      toast.error('Erro ao criar agente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0">
        <div className="flex h-[95vh]">
          {/* Coluna Esquerda - Configurações */}
          <div className="flex-1 overflow-y-auto p-6 pr-3">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                Editar Agente
              </DialogTitle>
            </DialogHeader>

            <form className="space-y-6">
              {/* Workspace */}
              <div className="space-y-2">
                <Label htmlFor="workspace">Empresa</Label>
                <Select value={formData.workspace_id} onValueChange={(value) => setFormData({ ...formData, workspace_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do agente"
                />
              </div>

              {/* Tipo e Modelo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Agente</Label>
                  <Select value={formData.agent_type} onValueChange={(value) => setFormData({ ...formData, agent_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPENAI_COMPLETION">OPEN AI Padrão</SelectItem>
                      <SelectItem value="OPENAI_ASSISTANT">OPEN AI Assistant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo Open AI</Label>
                  <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder="sk-proj-..."
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>


              {/* Instruções */}
              <div className="space-y-2">
                <Label htmlFor="instructions">Instruções</Label>
                <Textarea
                  id="instructions"
                  value={formData.system_instructions}
                  onChange={(e) => setFormData({ ...formData, system_instructions: e.target.value })}
                  placeholder="Instruções para o comportamento do agente..."
                  rows={8}
                  className="font-mono text-sm cursor-pointer"
                  readOnly={false}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="14 9 9 4 4 9"></polyline>
                    <path d="M20 20h-7a4 4 0 0 1-4-4V4"></path>
                  </svg>
                  <span>Clique nas instruções para adicionar ações automáticas</span>
                </div>
              </div>

              {/* Base de Conhecimento */}
              <div className="space-y-3">
                <Label>Base de conhecimento</Label>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileUpload}
                    />
                    <div className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg hover:bg-accent transition-colors">
                      <Plus className="h-4 w-4" />
                      <span className="text-sm">Adicionar</span>
                    </div>
                  </label>
                  
                  {formData.knowledge_files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm truncate max-w-[150px]" title={file.name}>
                        {file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Links Google Sheets */}
              <div className="space-y-3">
                <Label>Links de Planilhas Google Sheets</Label>
                <p className="text-xs text-muted-foreground">
                  Certifique-se de liberar o acesso ao documento clicando em compartilhar e definindo o acesso para qualquer pessoa com o link
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Cole o link da planilha do Google Sheets"
                    value={newSheetLink}
                    onChange={(e) => setNewSheetLink(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={handleAddSheetLink} title="Adicionar link">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.google_sheets_links.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-accent rounded-lg">
                    <span className="text-sm flex-1 truncate">{link}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSheetLink(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <hr className="my-6" />

              {/* Agendamentos */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.enable_scheduling}
                    onCheckedChange={(checked) => setFormData({ ...formData, enable_scheduling: checked })}
                  />
                  <Label>Agendamentos</Label>
                </div>
                <Button type="button" size="sm" variant="default">
                  + Contas
                </Button>
              </div>

              <hr className="my-6" />

              {/* Configurações Avançadas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperatura</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    max="2"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Máx. de Tokens na resposta</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-messages">Máx. de mensagens no Histórico</Label>
                  <Input
                    id="max-messages"
                    type="number"
                    value={formData.max_messages_history}
                    onChange={(e) => setFormData({ ...formData, max_messages_history: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delay">Delay para responder mensagens (segundos)</Label>
                  <Input
                    id="delay"
                    type="number"
                    value={formData.delay_to_receive}
                    onChange={(e) => setFormData({ ...formData, delay_to_receive: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ignore-until">Ignorar mensagens até X segundos que a conversa foi criada</Label>
                  <Input
                    id="ignore-until"
                    type="number"
                    value={formData.ignore_messages_until}
                    onChange={(e) => setFormData({ ...formData, ignore_messages_until: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reply-old">Responder tickets com responsável</Label>
                  <Select 
                    value={formData.reply_old_tickets.toString()} 
                    onValueChange={(value) => setFormData({ ...formData, reply_old_tickets: value === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Não</SelectItem>
                      <SelectItem value="true">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 p-4 bg-accent/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.split_messages}
                    onCheckedChange={(checked) => setFormData({ ...formData, split_messages: checked })}
                  />
                  <Label>Dividir respostas em blocos</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.process_images}
                    onCheckedChange={(checked) => setFormData({ ...formData, process_images: checked })}
                  />
                  <Label>Processar imagens</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.disable_when_answer}
                    onCheckedChange={(checked) => setFormData({ ...formData, disable_when_answer: checked })}
                  />
                  <Label>Desabilitar agente quando responder fora da plataforma</Label>
                </div>
              </div>

              <hr className="my-6" />

              {/* Regras de Ativação */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Regras de Ativação</h3>
                  <Button type="button" variant="ghost" size="sm" title="Configure quando o prompt deve ou não responder através de regras específicas">
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma regra configurada. O prompt responderá para todos os contatos.
                  </CardContent>
                </Card>
                <Button type="button" variant="default" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Grupo de Regras
                </Button>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} type="button">
                  Voltar
                </Button>
                <Button onClick={handleSave} disabled={loading} type="button">
                  {loading ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>

          {/* Coluna Direita - Teste do Agente */}
          <div className="w-[400px] border-l bg-accent/20 flex flex-col">
            <div className="p-4 border-b bg-background/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Teste do Agente</h3>
              <Button type="button" variant="ghost" size="sm" onClick={handleResetTest}>
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {testMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Sem mensagens. Inicie uma conversa!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {testMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-8'
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-background/50">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendTestMessage()}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendTestMessage}
                  disabled={!testMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}