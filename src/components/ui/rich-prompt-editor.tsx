import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number;
}

interface ParsedAction {
  fullText: string;
  displayLabel: string;
  type: string;
  params: Record<string, string>;
}

interface RichPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface PromptEditorRef {
  getCursorPosition: () => number;
  insertText: (text: string) => void;
}

type EditorNode = 
  | { type: 'text', content: string }
  | { type: 'action', content: string, displayLabel: string, id: string };

function parseAction(actionText: string): ParsedAction {
  // Extrair parâmetros usando regex
  const paramRegex = /\[([^\]]+):\s*([^\]]+)\]/g;
  const params: Record<string, string> = {};
  
  let match;
  while ((match = paramRegex.exec(actionText)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    params[key] = value;
  }
  
  // Determinar tipo e criar label amigável
  let displayLabel = "";
  let type = "";
  
  if (params.tag_name) {
    type = "add-tag";
    displayLabel = `Adicionar tag: ${params.tag_name}`;
  } else if (params.fila_id) {
    type = "transfer-queue";
    displayLabel = `Transferir para fila`;
  } else if (params.conection_name) {
    type = "transfer-connection";
    displayLabel = `Transferir para conexão: ${params.conection_name}`;
  } else if (params.pipeline_id && params.coluna_id) {
    type = params.card_id ? "transfer-crm-card" : "create-crm-card";
    displayLabel = `${type === "create-crm-card" ? "Criar" : "Transferir"} card CRM`;
  } else {
    // Fallback para ações não reconhecidas
    displayLabel = actionText.substring(0, 50) + (actionText.length > 50 ? "..." : "");
    type = "unknown";
  }
  
  return {
    fullText: actionText,
    displayLabel,
    type,
    params
  };
}

function parseTextToNodes(text: string): EditorNode[] {
  const actionRegex = /(\[ADD_ACTION\]:[^\n]+)/g;
  const nodes: EditorNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = actionRegex.exec(text)) !== null) {
    // Texto antes da ação
    if (match.index > lastIndex) {
      const textContent = text.substring(lastIndex, match.index);
      if (textContent) {
        nodes.push({ type: 'text', content: textContent });
      }
    }
    
    // A ação em si - parse para obter displayLabel
    const parsedAction = parseAction(match[0]);
    nodes.push({ 
      type: 'action', 
      content: parsedAction.fullText, // String completa para salvar
      displayLabel: parsedAction.displayLabel, // Label amigável para exibir
      id: `action-${match.index}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Texto restante após a última ação
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex);
    if (textContent) {
      nodes.push({ type: 'text', content: textContent });
    }
  }
  
  return nodes;
}

function nodesToText(nodes: EditorNode[]): string {
  return nodes.map(node => node.content).join('');
}

export const RichPromptEditor = forwardRef<PromptEditorRef, RichPromptEditorProps>(({
  value,
  onChange,
  placeholder,
  className,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isUpdatingRef = useRef(false);

  // Renderizar conteúdo inicial e quando value mudar EXTERNAMENTE
  useEffect(() => {
    if (!containerRef.current || isUpdatingRef.current) return;
    
    const currentDOMValue = extractValueFromDOM();
    
    // Só atualizar se o valor externo for diferente do DOM atual
    if (value !== currentDOMValue) {
      const nodes = parseTextToNodes(value || "");
      renderNodes(nodes);
    }
  }, [value]);

  const extractValueFromDOM = (): string => {
    if (!containerRef.current) return "";
    
    const parts: string[] = [];
    
    containerRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || "");
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.dataset.actionContent) {
          parts.push(element.dataset.actionContent);
        } else {
          parts.push(element.textContent || "");
        }
      }
    });
    
    return parts.join('');
  };

  const renderNodes = (nodes: EditorNode[]) => {
    if (!containerRef.current) return;
    
    // Salvar posição do cursor
    const selection = window.getSelection();
    let savedRange: Range | null = null;
    
    if (selection && selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
    
    // Limpar e renderizar
    containerRef.current.innerHTML = '';
    
    nodes.forEach((node) => {
      if (node.type === 'text') {
        const textNode = document.createTextNode(node.content);
        containerRef.current!.appendChild(textNode);
      } else {
        const badge = document.createElement('span');
        badge.contentEditable = 'false';
        badge.dataset.actionId = node.id;
        badge.dataset.actionContent = node.content;
        badge.className = 'inline-flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium mx-0.5 border border-primary/20';
        badge.style.userSelect = 'none';
        
        const label = document.createElement('span');
        label.textContent = node.displayLabel;
        badge.appendChild(label);
        
        const button = document.createElement('button');
        button.className = 'hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors';
        button.tabIndex = -1;
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        button.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveAction(node.id);
        };
        badge.appendChild(button);
        
        containerRef.current!.appendChild(badge);
      }
    });
    
    // Restaurar cursor (se possível)
    if (savedRange && selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (e) {
        // Cursor pode não ser restaurável
      }
    }
  };

  const handleRemoveAction = (actionId: string) => {
    if (!containerRef.current) return;
    
    const badge = containerRef.current.querySelector(`[data-action-id="${actionId}"]`);
    if (badge) {
      badge.remove();
      
      // Atualizar valor
      const newValue = extractValueFromDOM();
      isUpdatingRef.current = true;
      onChange(newValue);
      setTimeout(() => { isUpdatingRef.current = false; }, 0);
    }
  };

  const getCursorPosition = (): number => {
    if (!containerRef.current) return 0;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(containerRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    return preCaretRange.toString().length;
  };

  const insertText = (text: string) => {
    if (!containerRef.current) return;

    console.log('🔍 insertText chamado com:', text);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Se não há seleção, adicionar no final
      containerRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(containerRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    // Inserir o texto
    const isAction = text.startsWith('[ADD_ACTION]:');
    console.log('🔍 isAction:', isAction);
    
    if (isAction) {
      const nodes = parseTextToNodes(text);
      console.log('🔍 nodes parseados:', nodes);
      
      nodes.forEach(node => {
        if (node.type === 'action') {
          const badge = document.createElement('span');
          badge.contentEditable = 'false';
          badge.dataset.actionId = node.id;
          badge.dataset.actionContent = node.content;
          badge.className = 'inline-flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium mx-0.5 border border-primary/20';
          badge.style.userSelect = 'none';
          
          const label = document.createElement('span');
          label.textContent = node.displayLabel;
          badge.appendChild(label);
          
          const button = document.createElement('button');
          button.className = 'hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors';
          button.tabIndex = -1;
          button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
          button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRemoveAction(node.id);
          };
          badge.appendChild(button);
          
          const range = selection!.getRangeAt(0);
          range.deleteContents();
          range.insertNode(badge);
          range.setStartAfter(badge);
          range.collapse(true);
          selection!.removeAllRanges();
          selection!.addRange(range);
        }
      });
    } else {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Atualizar valor
    const newValue = extractValueFromDOM();
    console.log('🔍 newValue após inserção:', newValue);
    isUpdatingRef.current = true;
    onChange(newValue);
    setTimeout(() => { isUpdatingRef.current = false; }, 0);
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
  }));

  const handleContainerInput = () => {
    const newValue = extractValueFromDOM();
    console.log('🔍 handleContainerInput - newValue:', newValue);
    
    isUpdatingRef.current = true;
    onChange(newValue);
    setTimeout(() => { isUpdatingRef.current = false; }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertText('\n');
      return;
    }
    
    // Prevenir edição direta de badges
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Verificar se está tentando editar dentro de um badge
      let node: Node | null = container;
      while (node && node !== containerRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (element.dataset.actionId) {
            // Está dentro de um badge, prevenir edição
            if (e.key === 'Backspace' || e.key === 'Delete') {
              return; // Deixar o handleRemoveAction cuidar disso
            }
            e.preventDefault();
            return;
          }
        }
        node = node.parentNode;
      }
    }
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleContainerInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "w-full min-h-[400px] p-4 rounded-md border border-input bg-background",
          "text-sm resize-none overflow-y-auto",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          className
        )}
        data-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      />
    </div>
  );
});

RichPromptEditor.displayName = "RichPromptEditor";
