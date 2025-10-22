import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

interface PromptEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
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
    label: "Transferir Ticket",
    icon: <ArrowRightLeft className="w-4 h-4" />,
    tag: 'utilize o tools do agente `transferir-ticket` enviando esses parâmetros: {{action: "transferTicket", params: {"queueId": ""}}}',
  },
  {
    id: "send-schedule",
    label: "Enviar horários",
    icon: <Clock className="w-4 h-4" />,
    tag: 'utilize o tools do agente `enviar-horarios`: {{action: "sendAvailableHours"}}',
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
    label: "Salvar variável",
    icon: <Database className="w-4 h-4" />,
    tag: 'utilize o tools do agente `salvar-variavel` enviando esses parâmetros: {{action: "saveVariable", params: {"name": "", "value": ""}}}',
  },
  {
    id: "http-request",
    label: "Requisição HTTP",
    icon: <Link2 className="w-4 h-4" />,
    tag: 'utilize o tools do agente `requisicao-http` enviando esses parâmetros: {{action: "httpRequest", params: {"url": "", "method": "GET"}}}',
  },
  {
    id: "randomize-channel",
    label: "Randomizar Canal",
    icon: <Shuffle className="w-4 h-4" />,
    tag: 'utilize o tools do agente `randomizar-canal`: {{action: "randomizeChannel"}}',
  },
];

export function PromptEditorModal({
  open,
  onOpenChange,
  value,
  onChange,
}: PromptEditorModalProps) {
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draggedAction, setDraggedAction] = useState<ActionButton | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [pendingCursorPosition, setPendingCursorPosition] = useState(0);

  const handleDragStart = (action: ActionButton) => {
    setDraggedAction(action);
  };

  const handleDragEnd = () => {
    setDraggedAction(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedAction || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;

    // Interceptar ação "add-tag" para abrir modal de seleção
    if (draggedAction.id === "add-tag") {
      setPendingCursorPosition(cursorPosition);
      setShowTagSelector(true);
      setDraggedAction(null);
      return;
    }

    // Para outras ações, inserir diretamente
    const textBefore = localValue.substring(0, cursorPosition);
    const textAfter = localValue.substring(cursorPosition);
    
    const newValue = textBefore + "\n" + draggedAction.tag + "\n" + textAfter;
    setLocalValue(newValue);
    
    // Posicionar cursor após a tag inserida
    setTimeout(() => {
      const newPosition = cursorPosition + draggedAction.tag.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleTagSelected = (tagId: string, tagName: string) => {
    const jsonToInsert = `utilize o tools do agente \`inserir-tag\` enviando esses parâmetros: {{action: "addTag", params: {"tagId": "${tagId}", "tagName": "${tagName}"}}}`;
    
    const textBefore = localValue.substring(0, pendingCursorPosition);
    const textAfter = localValue.substring(pendingCursorPosition);
    
    const newValue = textBefore + "\n" + jsonToInsert + "\n" + textAfter;
    setLocalValue(newValue);
    
    // Posicionar cursor após a tag inserida
    if (textareaRef.current) {
      setTimeout(() => {
        const newPosition = pendingCursorPosition + jsonToInsert.length + 2;
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSave = () => {
    onChange(localValue);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
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
            <Textarea
              ref={textareaRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="Digite o prompt do agente aqui... Arraste e solte os botões abaixo para adicionar ações automáticas."
              className="min-h-[400px] font-mono text-sm resize-none"
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
      />
    </Dialog>
  );
}
