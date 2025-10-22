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
import { Bot, Eye, EyeOff, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { PromptEditorModal } from "./PromptEditorModal";

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
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const { workspaces, isLoading: loadingWorkspaces } = useWorkspaces();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agent_type: 'conversational',
    api_key: '',
    assistant_id: '',
    model: 'gpt-4o-mini',
    system_instructions: 'Você é um assistente útil e prestativo.',
    temperature: 0.7,
    max_tokens: 1000,
    response_delay_ms: 1000,
    knowledge_base_enabled: false,
    is_active: true,
    workspace_id: '',
  });

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
          description: formData.description,
          agent_type: formData.agent_type,
          api_key_encrypted: formData.api_key, // TODO: Implementar criptografia
          model: formData.model,
          system_instructions: formData.system_instructions,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          response_delay_ms: formData.response_delay_ms,
          knowledge_base_enabled: formData.knowledge_base_enabled,
          is_active: formData.is_active,
          workspace_id: formData.workspace_id,
          api_provider: 'openai',
          auto_responses_enabled: true,
          working_hours_enabled: false,
          working_days: [1, 2, 3, 4, 5],
          fallback_message: 'Desculpe, não estou disponível no momento.',
        }]);

      if (error) throw error;
      
      toast.success('Agente criado com sucesso!');
      onAgentCreated?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        agent_type: 'conversational',
        api_key: '',
        assistant_id: '',
        model: 'gpt-4o-mini',
        system_instructions: 'Você é um assistente útil e prestativo.',
        temperature: 0.7,
        max_tokens: 1000,
        response_delay_ms: 1000,
        knowledge_base_enabled: false,
        is_active: true,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Adicionar Agente
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-6">
          {/* Coluna Esquerda */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace">Empresa *</Label>
              <Select 
                value={formData.workspace_id} 
                onValueChange={(value) => setFormData({ ...formData, workspace_id: value })}
                disabled={loadingWorkspaces}
              >
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
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do agente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <div className="relative">
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do agente (clique no botão ao lado para usar o editor avançado)"
                  rows={3}
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1"
                  onClick={() => setShowPromptEditor(true)}
                  title="Abrir editor de prompt com ações"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.agent_type} onValueChange={(value) => setFormData({ ...formData, agent_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversational">Conversacional</SelectItem>
                  <SelectItem value="support">Suporte</SelectItem>
                  <SelectItem value="sales">Vendas</SelectItem>
                  <SelectItem value="assistant">Assistente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key *</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="sk-..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistant-id">ID do Assistente</Label>
              <Input
                id="assistant-id"
                value={formData.assistant_id}
                onChange={(e) => setFormData({ ...formData, assistant_id: e.target.value })}
                placeholder="asst_..."
              />
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instruções do Sistema *</Label>
              <Textarea
                id="instructions"
                value={formData.system_instructions}
                onChange={(e) => setFormData({ ...formData, system_instructions: e.target.value })}
                placeholder="Instruções para o comportamento do agente"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Temperatura: {formData.temperature}</Label>
              <Slider
                value={[formData.temperature]}
                onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-tokens">Máximo de Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                value={formData.max_tokens}
                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                min={1}
                max={4000}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="knowledge-base">Base de Conhecimento</Label>
                <Switch
                  id="knowledge-base"
                  checked={formData.knowledge_base_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, knowledge_base_enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Agente Ativo</Label>
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>

      <PromptEditorModal
        open={showPromptEditor}
        onOpenChange={setShowPromptEditor}
        value={formData.description}
        onChange={(value) => setFormData({ ...formData, description: value })}
        workspaceId={formData.workspace_id}
      />
    </Dialog>
  );
}