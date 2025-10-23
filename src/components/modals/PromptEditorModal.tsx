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
  const text = textPart.trim();
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

export function PromptEditorModal({
  open,
  onOpenChange,
  value,
  onChange,
  workspaceId,
}: PromptEditorModalProps) {
  const [localValue, setLocalValue] = useState("");
  const [badges, setBadges] = useState<ActionBadge[]>([]);
  const [draggedAction, setDraggedAction] = useState<ActionButton | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showPipelineColumnSelector, setShowPipelineColumnSelector] = useState(false);
  const [editingBadge, setEditingBadge] = useState<ActionBadge | null>(null);
  const editorRef = useRef<PromptEditorRef>(null);

  // Sincronizar estado local com props quando modal abre
  useEffect(() => {
    if (open) {
      const parsed = parseBadgesFromPrompt(value);
      setLocalValue(parsed.text);
      setBadges(parsed.badges);
    }
  }, [open, value]);

  const handleDragStart = (action: ActionButton) => {
    setDraggedAction(action);
  };

  const handleDragEnd = () => {
    setDraggedAction(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedAction) return;

    // Interceptar ação "add-tag" para abrir modal de seleção
    if (draggedAction.id === "add-tag") {
      setShowTagSelector(true);
      setDraggedAction(null);
      return;
    }

    // Interceptar ação "transfer-crm-column" para abrir modal de seleção
    if (draggedAction.id === "transfer-crm-column" || draggedAction.id === "create-crm-card") {
      setShowPipelineColumnSelector(true);
      setDraggedAction(null);
      return;
    }

    // Obter posição do cursor
    const cursorPosition = editorRef.current?.getCursorPosition() || localValue.length;

    // Para outras ações, criar badge genérico
    const newBadge: ActionBadge = {
      id: `${draggedAction.id}-${Date.now()}`,
      type: draggedAction.id,
      label: draggedAction.label,
      data: {},
      position: cursorPosition,
    };

    setBadges([...badges, newBadge]);
    setDraggedAction(null);
  };

  const handleTagSelected = (tagId: string, tagName: string) => {
    if (editingBadge) {
      // Editando badge existente
      const updatedBadges = badges.map((b) =>
        b.id === editingBadge.id
          ? { ...b, label: `Adicionar Tag: ${tagName}`, data: { tagId, tagName } }
          : b
      );
      setBadges(updatedBadges);
      setEditingBadge(null);
    } else {
      // Obter posição do cursor
      const cursorPosition = editorRef.current?.getCursorPosition() || localValue.length;

      // Criando novo badge
      const newBadge: ActionBadge = {
        id: `add-tag-${Date.now()}`,
        type: "add-tag",
        label: `Adicionar Tag: ${tagName}`,
        data: { tagId, tagName },
        position: cursorPosition,
      };
      setBadges([...badges, newBadge]);
    }
  };

  const handlePipelineColumnSelected = (
    pipelineId: string, 
    pipelineName: string, 
    columnId: string, 
    columnName: string
  ) => {
    if (editingBadge) {
      // Editando badge existente
      const label = editingBadge.type === "create-crm-card" 
        ? `Criar Card CRM: ${pipelineName} | ${columnName}`
        : `Transferir Coluna CRM: ${columnName}`;
      
      const updatedBadges = badges.map((b) =>
        b.id === editingBadge.id
          ? { ...b, label, data: { pipelineId, pipelineName, columnId, columnName } }
          : b
      );
      setBadges(updatedBadges);
      setEditingBadge(null);
    } else {
      // Obter posição do cursor
      const cursorPosition = editorRef.current?.getCursorPosition() || localValue.length;

      // Criando novo badge (determinar tipo baseado no draggedAction anterior)
      const actionType = draggedAction?.id || "transfer-crm-column";
      const label = actionType === "create-crm-card"
        ? `Criar Card CRM: ${pipelineName} | ${columnName}`
        : `Transferir Coluna CRM: ${columnName}`;
      
      const newBadge: ActionBadge = {
        id: `${actionType}-${Date.now()}`,
        type: actionType,
        label,
        data: { pipelineId, pipelineName, columnId, columnName },
        position: cursorPosition,
      };
      setBadges([...badges, newBadge]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBadgeClick = (badge: ActionBadge) => {
    setEditingBadge(badge);
    if (badge.type === "add-tag") {
      setShowTagSelector(true);
    } else if (badge.type === "create-crm-card" || badge.type === "transfer-crm-column") {
      setShowPipelineColumnSelector(true);
    }
  };

  const handleEditorChange = (text: string, updatedBadges: ActionBadge[]) => {
    setLocalValue(text);
    setBadges(updatedBadges);
  };

  const handleSave = () => {
    // Construir o prompt final com badges e texto
    let finalPrompt = localValue.trim();
    
    // Só adicionar seção de ações se houver badges
    if (badges.length > 0) {
      finalPrompt += "\n\n--- AÇÕES CONFIGURADAS ---\n";
      badges.forEach((badge) => {
        if (badge.type === "add-tag") {
          finalPrompt += `\n[Adicionar Tag: ${badge.data.tagName}]`;
        } else if (badge.type === "create-crm-card") {
          finalPrompt += `\n[Criar Card CRM: ${badge.data.pipelineName} | ${badge.data.columnName}]`;
        } else if (badge.type === "transfer-crm-column") {
          finalPrompt += `\n[Transferir Coluna CRM: ${badge.data.columnName}]`;
        } else {
          finalPrompt += `\n[${badge.label}]`;
        }
      });
    }
    
    onChange(finalPrompt);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Resetar completamente o estado local
    const parsed = parseBadgesFromPrompt(value);
    setLocalValue(parsed.text);
    setBadges(parsed.badges);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Editor de Prompt com Ações</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Area */}
          <div 
            className="flex-1 p-6 overflow-y-auto"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <PromptEditor
              ref={editorRef}
              value={localValue}
              onChange={handleEditorChange}
              badges={badges}
              onBadgeClick={handleBadgeClick}
              placeholder="Digite o prompt do agente aqui... Arraste e solte os botões abaixo para adicionar ações automáticas."
              className="min-h-[400px]"
            />
            
            {draggedAction && (
              <div className="mt-4 p-4 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5 text-center text-sm text-muted-foreground">
                Solte aqui para inserir: <span className="font-semibold">{draggedAction.label}</span>
              </div>
            )}
          </div>

          {/* Action Buttons Bar */}
          <div className="border-t bg-muted/30 px-6 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Arraste e solte as ações abaixo no editor para inseri-las no prompt
            </p>
            <div className="flex flex-wrap gap-2">
              {actionButtons.map((action) => (
                <button
                  key={action.id}
                  draggable
                  onDragStart={() => handleDragStart(action)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                    "bg-background border border-border",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "transition-colors cursor-move",
                    "text-sm font-medium"
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {action.icon}
                  </div>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
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
