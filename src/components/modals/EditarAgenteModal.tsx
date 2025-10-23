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
import { Eye, EyeOff, FileText, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { PromptEditorModal } from "./PromptEditorModal";

interface EditarAgenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onAgentUpdated?: () => void;
}

interface FormData {
  workspace_id: string;
  name: string;
  agent_type: string;
  api_key: string;
  model: string;
  system_instructions: string;
  temperature: number;
  max_tokens: number;
  max_messages: number;
  response_delay: number;
  ignore_interval: number;
  assign_responsible: boolean;
  split_responses: boolean;
  process_messages: boolean;
  disable_outside_platform: boolean;
  is_active: boolean;
}

export function EditarAgenteModal({
  open,
  onOpenChange,
  agentId,
  onAgentUpdated
}: EditarAgenteModalProps) {
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const { workspaces } = useWorkspaces();

  const [formData, setFormData] = useState<FormData>({
    workspace_id: '',
    name: '',
    agent_type: 'conversational',
    api_key: '',
    model: 'gpt-4o-mini',
    system_instructions: 'Você é um assistente útil e prestativo.',
    temperature: 0.7,
    max_tokens: 2000,
    max_messages: 300,
    response_delay: 3,
    ignore_interval: 0,
    assign_responsible: false,
    split_responses: true,
    process_messages: true,
    disable_outside_platform: false,
    is_active: true,
  });

  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [currentKnowledgeUrl, setCurrentKnowledgeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && agentId) {
      loadAgentData();
    }
  }, [open, agentId]);

  const loadAgentData = async () => {
    if (!agentId) {
      console.log('⚠️ Nenhum agentId fornecido');
      return;
    }

    console.log('🔍 Carregando agente:', agentId);

    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .maybeSingle();

      console.log('📦 Dados recebidos:', data);
      console.log('❌ Erro:', error);

      if (error) {
        console.error('Erro ao carregar agente:', error);
        toast.error(`Erro ao carregar agente: ${error.message}`);
        return;
      }

      if (!data) {
        console.error('Agente não encontrado:', agentId);
        toast.error('Agente não encontrado');
        return;
      }

      const loadedFormData = {
        workspace_id: data.workspace_id || '',
        name: data.name || '',
        agent_type: data.agent_type || 'conversational',
        api_key: data.api_key_encrypted || '',
        model: data.model || 'gpt-4o-mini',
        system_instructions: data.system_instructions || 'Você é um assistente útil e prestativo.',
        temperature: data.temperature || 0.7,
        max_tokens: data.max_tokens || 2000,
        max_messages: data.max_messages || 300,
        response_delay: (data.response_delay_ms || 3000) / 1000,
        ignore_interval: data.ignore_interval || 0,
        assign_responsible: data.assign_responsible || false,
        split_responses: data.split_responses ?? true,
        process_messages: data.process_messages ?? true,
        disable_outside_platform: data.disable_outside_platform || false,
        is_active: data.is_active ?? true,
      };

      setFormData(loadedFormData);
      setCurrentKnowledgeUrl(data.knowledge_base_url);
      console.log('✅ FormData preenchido:', loadedFormData);
    } catch (error: any) {
      console.error('💥 Exceção ao carregar agente:', error);
      toast.error('Erro ao carregar dados do agente');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKnowledgeFile(file);
    }
  };

  const handleRemoveFile = () => {
    setKnowledgeFile(null);
  };

  const handleRemoveCurrentKnowledge = () => {
    setCurrentKnowledgeUrl(null);
  };

  const handleSave = async () => {
    if (!formData.workspace_id || !formData.name || !formData.api_key) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload do arquivo de conhecimento (se houver novo)
      let knowledgeBaseUrl = currentKnowledgeUrl;
      if (knowledgeFile) {
        const filePath = `${formData.workspace_id}/${agentId}/${knowledgeFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('agent-knowledge')
          .upload(filePath, knowledgeFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('agent-knowledge')
          .getPublicUrl(filePath);
        
        knowledgeBaseUrl = publicUrl;
      }

      // 2. Atualizar agente no banco
      const { error } = await supabase
        .from('ai_agents')
        .update({
          workspace_id: formData.workspace_id,
          name: formData.name,
          agent_type: formData.agent_type,
          api_key_encrypted: formData.api_key,
          model: formData.model,
          system_instructions: formData.system_instructions,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          max_messages: formData.max_messages,
          response_delay_ms: formData.response_delay * 1000,
          ignore_interval: formData.ignore_interval,
          assign_responsible: formData.assign_responsible,
          split_responses: formData.split_responses,
          process_messages: formData.process_messages,
          disable_outside_platform: formData.disable_outside_platform,
          knowledge_base_url: knowledgeBaseUrl,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (error) throw error;

      toast.success('Agente atualizado com sucesso!');
      onAgentUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao atualizar agente:', error);
      toast.error(error.message || 'Erro ao atualizar agente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Agente de IA</DialogTitle>
        </DialogHeader>

        <form className="space-y-6">
          {/* Workspace e Nome */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Agente</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do agente"
              />
            </div>
          </div>

          {/* Tipo e Modelo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent_type">Tipo de Agente</Label>
              <Select value={formData.agent_type} onValueChange={(value) => setFormData({ ...formData, agent_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversational">Conversacional</SelectItem>
                  <SelectItem value="transactional">Transacional</SelectItem>
                  <SelectItem value="informational">Informacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo OpenAI</Label>
              <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key OpenAI</Label>
            <div className="flex gap-2">
              <Input
                id="api_key"
                type={showApiKey ? "text" : "password"}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="sk-..."
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Instruções do Sistema */}
          <div className="space-y-2">
            <Label htmlFor="system_instructions">Instruções do Sistema (Prompt)</Label>
            <Textarea
              id="system_instructions"
              value={formData.system_instructions}
              onClick={() => setShowPromptEditor(true)}
              placeholder="Clique para editar o prompt com ações avançadas..."
              rows={4}
              readOnly
              className="cursor-pointer hover:bg-accent/50 transition-colors"
            />
          </div>

          {/* Base de Conhecimento */}
          <div className="space-y-2">
            <Label>Base de Conhecimento</Label>
            <p className="text-sm text-muted-foreground">
              Adicione um arquivo (PDF, TXT, MD, etc.) para o agente usar como referência
            </p>
            
            <div className="space-y-3">
              {currentKnowledgeUrl && !knowledgeFile && (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm truncate">Arquivo existente</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveCurrentKnowledge}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {!knowledgeFile && !currentKnowledgeUrl && (
                <div className="border-2 border-dashed rounded-lg p-4">
                  <input
                    type="file"
                    id="knowledge-file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.txt,.md,.doc,.docx,.csv"
                  />
                  <label
                    htmlFor="knowledge-file"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Clique para adicionar arquivo</span>
                  </label>
                </div>
              )}

              {knowledgeFile && (
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm truncate">{knowledgeFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <hr className="my-6" />

          {/* Configurações Avançadas */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Configurações Avançadas</Label>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Temperatura ({formData.temperature})</Label>
              </div>
              <Slider
                value={[formData.temperature]}
                onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
                min={0}
                max={2}
                step={0.1}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_tokens">Máximo de Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_messages">Máx. Mensagens no Histórico</Label>
                <Input
                  id="max_messages"
                  type="number"
                  value={formData.max_messages}
                  onChange={(e) => setFormData({ ...formData, max_messages: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="response_delay">Delay para responder (segundos)</Label>
                <Input
                  id="response_delay"
                  type="number"
                  value={formData.response_delay}
                  onChange={(e) => setFormData({ ...formData, response_delay: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ignore_interval">Ignorar mensagens até X segundos</Label>
                <Input
                  id="ignore_interval"
                  type="number"
                  value={formData.ignore_interval}
                  onChange={(e) => setFormData({ ...formData, ignore_interval: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Dividir respostas em blocos</Label>
              <Switch
                checked={formData.split_responses}
                onCheckedChange={(checked) => setFormData({ ...formData, split_responses: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Processar mensagens automaticamente</Label>
              <Switch
                checked={formData.process_messages}
                onCheckedChange={(checked) => setFormData({ ...formData, process_messages: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Desabilitar quando responder fora da plataforma</Label>
              <Switch
                checked={formData.disable_outside_platform}
                onCheckedChange={(checked) => setFormData({ ...formData, disable_outside_platform: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Responder tickets com responsável</Label>
              <Switch
                checked={formData.assign_responsible}
                onCheckedChange={(checked) => setFormData({ ...formData, assign_responsible: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Agente Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <PromptEditorModal
        open={showPromptEditor}
        onOpenChange={setShowPromptEditor}
        value={formData.system_instructions}
        onChange={(value) => setFormData({ ...formData, system_instructions: value })}
        workspaceId={formData.workspace_id}
      />
    </Dialog>
  );
}
