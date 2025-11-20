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
import { ActionPreviewDisplay } from "@/components/ui/action-preview-display";
import { useQueryClient } from '@tanstack/react-query';

interface EditarAgenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onAgentUpdated?: () => void;
}

interface FormData {
  workspace_id: string;
  name: string;
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
  disable_outside_platform: boolean;
  is_active: boolean;
  configure_commands: string;
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
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    workspace_id: '',
    name: '',
    api_key: '',
    model: 'gpt-4o-mini',
    system_instructions: '',
    temperature: 0.7,
    max_tokens: 2000,
    max_messages: 300,
    response_delay: 3,
    ignore_interval: 0,
    assign_responsible: false,
    split_responses: true,
    disable_outside_platform: false,
    is_active: true,
    configure_commands: `[REGRAS DE INTERPRETAÇÃO DE COMANDOS - FORMATO COLCHETES]

Os comandos agora virão no formato de colchetes com instruções claras para o agente.

Sua tarefa é interpretar os comandos no formato especificado abaixo e executar as ações correspondentes.

---

📋 MAPEAMENTO DE AÇÕES:

1️⃣ Adicionar Tag:
Formato: [ENVIE PARA O TOOL \`inserir-tag\` (METODO POST) o id: UUID_DA_TAG]
Exemplo: [ENVIE PARA O TOOL \`inserir-tag\` (METODO POST) o id: 123e4567-e89b-12d3-a456-426614174000]

2️⃣ Transferir Fila:
Formato: [ENVIE PARA O TOOL \`transferir-fila\` (METODO POST) o id: UUID_DA_FILA]
Exemplo: [ENVIE PARA O TOOL \`transferir-fila\` (METODO POST) o id: 456e7890-e89b-12d3-a456-426614174111]

3️⃣ Transferir Conexão:
Formato: [ENVIE PARA O TOOL \`transferir-conexao\` (METODO POST) o id: UUID_DA_CONEXAO]
Exemplo: [ENVIE PARA O TOOL \`transferir-conexao\` (METODO POST) o id: 789e0123-e89b-12d3-a456-426614174222]

4️⃣ Criar Card CRM:
Formato: [ENVIE PARA O TOOL \`criar-card\` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA]
Formato com título: [ENVIE PARA O TOOL \`criar-card\` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA com o title TÍTULO_DO_CARD]
Exemplo: [ENVIE PARA O TOOL \`criar-card\` (METODO POST) o pipeline_id: abc-123-def e a coluna_id: ghi-456-jkl com o title Novo Lead]

5️⃣ Transferir Card para Coluna (CRM):
Formato: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA]
Exemplo: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) o pipeline_id: abc-123-def e a coluna_id: xyz-789-uvw]

6️⃣ Transferir Coluna do CRM (genérico):
Formato: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) movendo o card atual para a coluna_id: UUID_DA_COLUNA dentro do pipeline_id: UUID_DO_PIPELINE]
Exemplo: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) movendo o card atual para a coluna_id: xyz-789-uvw dentro do pipeline_id: abc-123-def]

7️⃣ Salvar Informações Adicionais:
Formato: [ENVIE PARA O TOOL \`info-adicionais\` (METODO POST) o id: UUID_DA_INFO e o valor VALOR_CORRESPONDENTE]
Exemplo: [ENVIE PARA O TOOL \`info-adicionais\` (METODO POST) o id: campo-empresa e o valor Tezeus Tech]

---

✅ REGRAS CRÍTICAS:

1. NUNCA use JSON novamente
2. SEMPRE escreva os comandos nesse formato de colchetes
3. NUNCA misture texto conversacional com comandos
4. SEMPRE utilize IDs reais (UUIDs)
5. Se faltar parâmetro obrigatório, ignore a ação
6. Todos os UUIDs estão no formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
7. Use backticks (\`) para envolver os nomes das tools
8. Escreva METODO POST em maiúsculas
9. Use "o id:", "o pipeline_id:", "a coluna_id:", "o valor" conforme especificado

---

⚠️ TRATAMENTO DE ERROS:

- Se o formato do comando estiver incorreto, ignore o comando e continue o processamento
- Se o UUID não estiver no formato correto, ignore o comando
- Se faltar algum parâmetro obrigatório, ignore o comando e registre um erro no log
- NUNCA tente executar comandos com IDs inválidos ou inexistentes`,
  });

  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<Array<{
    id: string;
    file_name: string;
    file_size: number;
    file_path: string;
  }>>([]);

  useEffect(() => {
    if (open && agentId) {
      loadAgentData();
      loadKnowledgeFiles();
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
        api_key: data.api_key_encrypted || '',
        model: data.model || 'gpt-4o-mini',
        system_instructions: data.system_instructions || '',
        temperature: data.temperature || 0.7,
        max_tokens: data.max_tokens || 2000,
        max_messages: data.max_messages || 300,
        response_delay: (data.response_delay_ms || 3000) / 1000,
        ignore_interval: data.ignore_interval || 0,
        assign_responsible: data.assign_responsible || false,
        split_responses: data.split_responses ?? true,
        disable_outside_platform: data.disable_outside_platform || false,
        is_active: data.is_active ?? true,
        configure_commands: data.configure_commands || '',
      };

      setFormData(loadedFormData);
      console.log('✅ FormData preenchido:', loadedFormData);
    } catch (error: any) {
      console.error('💥 Exceção ao carregar agente:', error);
      toast.error('Erro ao carregar dados do agente');
    }
  };

  const loadKnowledgeFiles = async () => {
    if (!agentId) return;
    
    try {
      const { data, error } = await supabase
        .from('ai_agent_knowledge_files')
        .select('id, file_name, file_size, file_path')
        .eq('agent_id', agentId);

      if (error) throw error;
      setKnowledgeFiles(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar arquivos:', error);
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

  const handleDeleteKnowledgeFile = async (fileId: string, filePath: string) => {
    try {
      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from('agent-knowledge')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Deletar do banco
      const { error: dbError } = await supabase
        .from('ai_agent_knowledge_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast.success('Arquivo excluído com sucesso');
      loadKnowledgeFiles();
    } catch (error) {
      console.error('❌ Erro ao deletar arquivo:', error);
      toast.error('Erro ao excluir arquivo');
    }
  };

  const handleSave = async () => {
    if (!formData.workspace_id || !formData.name || !formData.api_key) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload do arquivo de conhecimento (se houver novo)
      if (knowledgeFile) {
        // Validação de tamanho (máx 10MB)
        const maxSizeInBytes = 10 * 1024 * 1024;
        if (knowledgeFile.size > maxSizeInBytes) {
          toast.error('Arquivo muito grande. Tamanho máximo: 10MB');
          setLoading(false);
          return;
        }

        const filePath = `${formData.workspace_id}/${agentId}/${knowledgeFile.name}`;
        
        // Extrair texto do arquivo usando edge function
        const uploadFormData = new FormData();
        uploadFormData.append('file', knowledgeFile);

        const { data: extractData, error: extractError } = await supabase.functions.invoke(
          'extract-text-from-file',
          {
            body: uploadFormData,
          }
        );

        if (extractError) throw extractError;
        if (!extractData?.success) throw new Error(extractData?.error || 'Falha ao extrair texto do arquivo');

        const extractedText = extractData.text;

        // Upload para Storage
        const { error: uploadError } = await supabase.storage
          .from('agent-knowledge')
          .upload(filePath, knowledgeFile, { upsert: true });

        if (uploadError) throw uploadError;

        // Salvar na tabela ai_agent_knowledge_files com texto extraído
        const { error: fileError } = await supabase
          .from('ai_agent_knowledge_files')
          .insert([{
            agent_id: agentId,
            file_name: knowledgeFile.name,
            file_path: filePath,
            file_type: knowledgeFile.type,
            file_size: knowledgeFile.size,
            content_extracted: extractedText,
            is_processed: true,
          }]);

        if (fileError) throw fileError;
      }

      // 2. Atualizar agente no banco
      const { error } = await supabase
        .from('ai_agents')
        .update({
          workspace_id: formData.workspace_id,
          name: formData.name,
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
          disable_outside_platform: formData.disable_outside_platform,
          is_active: formData.is_active,
          configure_commands: formData.configure_commands,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (error) throw error;

      // Invalidar cache do workspace-agent para atualizar o botão
      queryClient.invalidateQueries({ queryKey: ['workspace-agent'] });

      toast.success('Agente atualizado com sucesso!');
      await loadKnowledgeFiles(); // Recarregar lista de arquivos
      setKnowledgeFile(null); // Limpar arquivo temporário
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

          {/* Modelo */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo OpenAI</Label>
              <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo-0125">gpt-3.5-turbo-0125</SelectItem>
                  <SelectItem value="gpt-3.5-turbo-1106">gpt-3.5-turbo-1106</SelectItem>
                  <SelectItem value="gpt-3.5-turbo-16k">gpt-3.5-turbo-16k</SelectItem>
                  <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                  <SelectItem value="gpt-4.1-2025-04-14">gpt-4.1-2025-04-14</SelectItem>
                  <SelectItem value="gpt-4.1-mini-2025-04-14">gpt-4.1-mini-2025-04-14</SelectItem>
                  <SelectItem value="gpt-4.1-nano">gpt-4.1-nano</SelectItem>
                  <SelectItem value="gpt-4.1-nano-2025-04-14">gpt-4.1-nano-2025-04-14</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4o-2024-05-13">gpt-4o-2024-05-13</SelectItem>
                  <SelectItem value="gpt-4o-2024-08-06">gpt-4o-2024-08-06</SelectItem>
                  <SelectItem value="gpt-4o-2024-11-20">gpt-4o-2024-11-20</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview">gpt-4o-audio-preview</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview-2024-10-01">gpt-4o-audio-preview-2024-10-01</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview-2024-12-17">gpt-4o-audio-preview-2024-12-17</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview-2025-06-03">gpt-4o-audio-preview-2025-06-03</SelectItem>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4o-mini-2024-07-18">gpt-4o-mini-2024-07-18</SelectItem>
                  <SelectItem value="gpt-4o-mini-audio-preview">gpt-4o-mini-audio-preview</SelectItem>
                  <SelectItem value="gpt-4o-mini-audio-preview-2024-12-17">gpt-4o-mini-audio-preview-2024-12-17</SelectItem>
                  <SelectItem value="gpt-4o-mini-search-preview">gpt-4o-mini-search-preview</SelectItem>
                  <SelectItem value="gpt-4o-mini-search-preview-2025-03-11">gpt-4o-mini-search-preview-2025-03-11</SelectItem>
                  <SelectItem value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</SelectItem>
                  <SelectItem value="gpt-4o-mini-tts">gpt-4o-mini-tts</SelectItem>
                  <SelectItem value="gpt-4o-search-preview">gpt-4o-search-preview</SelectItem>
                  <SelectItem value="gpt-4o-search-preview-2025-03-11">gpt-4o-search-preview-2025-03-11</SelectItem>
                  <SelectItem value="gpt-4o-transcribe">gpt-4o-transcribe</SelectItem>
                  <SelectItem value="gpt-4o-transcribe-diarize">gpt-4o-transcribe-diarize</SelectItem>
                  <SelectItem value="gpt-5">gpt-5</SelectItem>
                  <SelectItem value="gpt-5-2025-08-07">gpt-5-2025-08-07</SelectItem>
                  <SelectItem value="gpt-5-chat-latest">gpt-5-chat-latest</SelectItem>
                  <SelectItem value="gpt-5-codex">gpt-5-codex</SelectItem>
                  <SelectItem value="gpt-5-mini">gpt-5-mini</SelectItem>
                  <SelectItem value="gpt-5-mini-2025-08-07">gpt-5-mini-2025-08-07</SelectItem>
                  <SelectItem value="gpt-5-nano">gpt-5-nano</SelectItem>
                  <SelectItem value="gpt-5-nano-2025-08-07">gpt-5-nano-2025-08-07</SelectItem>
                  <SelectItem value="gpt-5-pro">gpt-5-pro</SelectItem>
                  <SelectItem value="gpt-5-pro-2025-10-06">gpt-5-pro-2025-10-06</SelectItem>
                  <SelectItem value="gpt-5-search-api">gpt-5-search-api</SelectItem>
                  <SelectItem value="gpt-5-search-api-2025-10-14">gpt-5-search-api-2025-10-14</SelectItem>
                  <SelectItem value="gpt-audio">gpt-audio</SelectItem>
                  <SelectItem value="gpt-audio-2025-08-28">gpt-audio-2025-08-28</SelectItem>
                  <SelectItem value="gpt-audio-mini">gpt-audio-mini</SelectItem>
                  <SelectItem value="gpt-audio-mini-2025-10-06">gpt-audio-mini-2025-10-06</SelectItem>
                  <SelectItem value="gpt-image-1">gpt-image-1</SelectItem>
                  <SelectItem value="gpt-image-1-mini">gpt-image-1-mini</SelectItem>
                  <SelectItem value="o1">o1</SelectItem>
                  <SelectItem value="o1-2024-12-17">o1-2024-12-17</SelectItem>
                  <SelectItem value="o1-mini">o1-mini</SelectItem>
                  <SelectItem value="o1-mini-2024-09-12">o1-mini-2024-09-12</SelectItem>
                  <SelectItem value="o3">o3</SelectItem>
                  <SelectItem value="o3-2025-04-16">o3-2025-04-16</SelectItem>
                  <SelectItem value="o3-mini">o3-mini</SelectItem>
                  <SelectItem value="o3-mini-2025-01-31">o3-mini-2025-01-31</SelectItem>
                  <SelectItem value="o4-mini">o4-mini</SelectItem>
                  <SelectItem value="o4-mini-2025-04-16">o4-mini-2025-04-16</SelectItem>
                  <SelectItem value="sora-2">sora-2</SelectItem>
                  <SelectItem value="sora-2-pro">sora-2-pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instruções do Sistema */}
          <div className="space-y-2">
            <Label htmlFor="system_instructions">Instruções do Sistema (Prompt)</Label>
            <div 
              onClick={() => setShowPromptEditor(true)}
              className="min-h-[100px] p-3 rounded-md border border-input bg-background cursor-pointer hover:bg-accent/50 transition-colors"
            >
              {formData.system_instructions ? (
                <ActionPreviewDisplay value={formData.system_instructions} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clique para editar o prompt com ações avançadas...
                </p>
              )}
            </div>
          </div>

          {/* Base de Conhecimento */}
          <div className="space-y-2">
            <Label>Base de Conhecimento</Label>
            <p className="text-sm text-muted-foreground">
              Adicione arquivos (PDF, TXT, MD, etc.) para o agente usar como referência
            </p>
            
            <div className="space-y-3">
              {/* Arquivos existentes */}
              {knowledgeFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Arquivos carregados</Label>
                  {knowledgeFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKnowledgeFile(file.id, file.file_path)}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload de novo arquivo */}
              {knowledgeFile ? (
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
              ) : (
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
                    <span className="text-sm text-muted-foreground">Adicionar novo arquivo</span>
                  </label>
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
