import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PromptEditor, ActionBadge, PromptEditorRef } from "@/components/ui/prompt-editor";
import { 
  Tag, 
  ArrowRightLeft, 
  Clock, 
  Phone, 
  FolderKanban, 
  ArrowRight, 
  Database, 
  Link2, 
  Shuffle 
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { TagSelectorModal } from "./TagSelectorModal";
import { PipelineColumnSelectorModal } from "./PipelineColumnSelectorModal";

interface PromptEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  workspaceId?: string;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  tag: string;
}

const actionButtons: ActionButton[] = [
  {
    id: "add-tag",
    label: "Adicionar Tag",
    icon: <Tag className="w-4 h-4" />,
    tag: 'utilize o tools do agente `inserir-tag` enviando esses parâmetros: {{action: "addTag", params: {"tagName": ""}}}',
  },
  {
    id: "transfer-ticket",
    label: "Transferir Fila/Conexão",
    icon: <ArrowRightLeft className="w-4 h-4" />,
    tag: 'utilize o tools do agente `transferir-ticket` enviando esses parâmetros: {{action: "transferTicket", params: {"queueId": ""}}}',
  },
  {
    id: "send-dsvoice",
    label: "Enviar funil DS Voice",
    icon: <Phone className="w-4 h-4" />,
    tag: 'utilize o tools do agente `enviar-funil-dsvoice`: {{action: "sendDSVoiceFunnel"}}',
  },
  {
    id: "create-crm-card",
    label: "Criar card no CRM",
    icon: <FolderKanban className="w-4 h-4" />,
    tag: 'utilize o tools do agente `criar-card-crm` enviando esses parâmetros: {{action: "crm.createCard", params: {"pipeline": "", "column": ""}}}',
  },
  {
    id: "transfer-crm-column",
    label: "Transferir coluna CRM",
    icon: <ArrowRight className="w-4 h-4" />,
    tag: 'utilize o tools do agente `transferir-coluna-crm` enviando esses parâmetros: {{action: "crm.transferColumn", params: {"columnId": ""}}}',
  },
  {
    id: "save-variable",
    label: "Salvar informações adicionais",
    icon: <Database className="w-4 h-4" />,
    tag: 'utilize o tools do agente `salvar-variavel` enviando esses parâmetros: {{action: "saveVariable", params: {"name": "", "value": ""}}}',
  },
  {
    id: "http-request",
    label: "Requisição HTTP",
    icon: <Link2 className="w-4 h-4" />,
    tag: 'utilize o tools do agente `requisicao-http` enviando esses parâmetros: {{action: "httpRequest", params: {"url": "", "method": "GET"}}}',
  },
];

// Função para fazer parsing de badges do prompt salvo
function parseBadgesFromPrompt(prompt: string): { text: string; badges: ActionBadge[] } {
  if (!prompt.includes("--- AÇÕES CONFIGURADAS ---")) {
    return { text: prompt, badges: [] };
  }

  const [textPart, actionsPart] = prompt.split("--- AÇÕES CONFIGURADAS ---");
  const text = textPart;
  const badges: ActionBadge[] = [];

  if (actionsPart) {
    const lines = actionsPart.split("\n").filter(line => line.trim().startsWith("["));
    lines.forEach((line, index) => {
      const match = line.match(/\[(.*?)\]/);
      if (match) {
        const content = match[1];
        let badge: ActionBadge | null = null;

        if (content.startsWith("Adicionar Tag: ")) {
          const tagName = content.replace("Adicionar Tag: ", "");
          badge = {
            id: `add-tag-${Date.now()}-${index}`,
            type: "add-tag",
            label: content,
            data: { tagName },
            position: text.length,
          };
        } else if (content.startsWith("Criar Card CRM: ")) {
          const parts = content.replace("Criar Card CRM: ", "").split(" | ");
          badge = {
            id: `create-crm-card-${Date.now()}-${index}`,
            type: "create-crm-card",
            label: content,
            data: { pipelineName: parts[0], columnName: parts[1] },
            position: text.length,
          };
        } else if (content.startsWith("Transferir Coluna CRM: ")) {
          const columnName = content.replace("Transferir Coluna CRM: ", "");
          badge = {
            id: `transfer-crm-column-${Date.now()}-${index}`,
            type: "transfer-crm-column",
            label: content,
            data: { columnName },
            position: text.length,
          };
        } else {
          badge = {
            id: `action-${Date.now()}-${index}`,
            type: "generic",
            label: content,
            data: {},
            position: text.length,
          };
        }

        if (badge) badges.push(badge);
      }
    });
  }

  return { text, badges };
}

// Função para formatar o preview do prompt para exibição no textarea
export function formatPromptPreview(prompt: string): string {
  if (!prompt) return "";
  
  const parsed = parseBadgesFromPrompt(prompt);
  let preview = parsed.text;
  
  // Adicionar badges formatados no final
  if (parsed.badges.length > 0) {
    preview += "\n\n--- AÇÕES CONFIGURADAS ---\n";
    parsed.badges.forEach((badge) => {
      preview += `\n[${badge.label}]`;
    });
  }
  
  return preview;
}

export function PromptEditorModal({
  open,
  onOpenChange,
  value,
  onChange,
  workspaceId,
}: PromptEditorModalProps) {
  const [localValue, setLocalValue] = useState("");
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showPipelineColumnSelector, setShowPipelineColumnSelector] = useState(false);
  const [pendingActionType, setPendingActionType] = useState<string | null>(null);
  const editorRef = useRef<PromptEditorRef>(null);

  // Sincronizar com o value quando o modal abre
  useEffect(() => {
    if (open) {
      setLocalValue(value || "");
    }
  }, [open, value]);

  const handleActionSelect = (action: ActionButton) => {
    // Ações que precisam de modal de seleção
    if (action.id === "add-tag") {
      setPendingActionType(action.id);
      setShowTagSelector(true);
      return;
    }

    if (action.id === "transfer-crm-column" || action.id === "create-crm-card") {
      setPendingActionType(action.id);
      setShowPipelineColumnSelector(true);
      return;
    }

    // Para outras ações genéricas, inserir texto diretamente
    const actionText = `\n${action.tag}\n`;
    editorRef.current?.insertText(actionText);
  };

  const handleTagSelected = (tagId: string, tagName: string) => {
    const actionText = `\nutilize o tools do agente \`inserir-tag\` enviando esses parâmetros: {{action: "addTag", params: {"tagName": "${tagName}"}}}\n`;
    editorRef.current?.insertText(actionText);
  };

  const handlePipelineColumnSelected = (
    pipelineId: string, 
    pipelineName: string, 
    columnId: string, 
    columnName: string
  ) => {
    const actionType = pendingActionType || "transfer-crm-column";
    
    let actionText = "";
    if (actionType === "create-crm-card") {
      actionText = `\nutilize o tools do agente \`criar-card-crm\` enviando esses parâmetros: {{action: "crm.createCard", params: {"pipeline": "${pipelineName}", "column": "${columnName}"}}}\n`;
    } else {
      actionText = `\nutilize o tools do agente \`transferir-coluna-crm\` enviando esses parâmetros: {{action: "crm.transferColumn", params: {"columnId": "${columnId}"}}}\n`;
    }
    
    editorRef.current?.insertText(actionText);
    setPendingActionType(null);
  };

  const handleSave = () => {
    onChange(localValue);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalValue(value || "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Editor de Prompt com Ações</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Area with Context Menu */}
          <div className="flex-1 p-6 overflow-y-auto">
            <ContextMenu>
              <ContextMenuTrigger className="w-full">
                <PromptEditor
                  ref={editorRef}
                  value={localValue}
                  onChange={setLocalValue}
                  placeholder="Digite o prompt do agente aqui... Clique com o botão direito para adicionar ações."
                  className="min-h-[400px]"
                />
              </ContextMenuTrigger>
              <ContextMenuContent className="w-64">
                {actionButtons.map((action) => (
                  <ContextMenuItem
                    key={action.id}
                    onClick={() => handleActionSelect(action)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {action.icon}
                    </div>
                    <span>{action.label}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Prompt
          </Button>
        </div>
      </DialogContent>

      <TagSelectorModal
        open={showTagSelector}
        onOpenChange={setShowTagSelector}
        onTagSelected={handleTagSelected}
        workspaceId={workspaceId}
      />

      <PipelineColumnSelectorModal
        open={showPipelineColumnSelector}
        onOpenChange={setShowPipelineColumnSelector}
        onColumnSelected={handlePipelineColumnSelected}
        workspaceId={workspaceId}
      />
    </Dialog>
  );
}
