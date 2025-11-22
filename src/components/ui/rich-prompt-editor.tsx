import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number;
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
  | { type: 'action', content: string, id: string, actionType: string, label: string, className: string };

interface ActionDetails {
  type: string;
  label: string;
  className: string;
  values: Record<string, string>;
}

function parseActionDetails(actionText: string): ActionDetails | null {
  console.log('🔍 Tentando fazer parse de:', actionText);
  
  // Adicionar Tag
  const tagMatch = actionText.match(/\[ADD_ACTION\]:\s*\[tag_name:\s*(.*?)\]\s*,\s*\[tag_id:\s*(.*?)\]\s*,\s*\[contact_id:\s*CONTACT_ID\]/);
  if (tagMatch) {
    console.log('✅ Match encontrado: adicionar tag');
    return {
      type: 'adicionar_tag',
      label: `Adicionar Tag: ${tagMatch[1]}`,
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      values: { tag_name: tagMatch[1], tag_id: tagMatch[2] }
    };
  }

  // Transferir Coluna CRM
  const colunaMatch = actionText.match(/\[ADD_ACTION\]:\s*\[pipeline_id:\s*(.*?)\]\s*,\s*\[coluna_id:\s*(.*?)\]\s*,\s*\[card_id:\s*ID_DO_CARD\]\s*,\s*\[contact_id:\s*CONTACT_ID\]/);
  if (colunaMatch) {
    console.log('✅ Match encontrado: transferir coluna crm');
    return {
      type: 'transferir_coluna_crm',
      label: 'Transferir Coluna CRM',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      values: { pipeline_id: colunaMatch[1], coluna_id: colunaMatch[2] }
    };
  }

  // Transferir Conexão
  const conexaoMatch = actionText.match(/\[ADD_ACTION\]:\s*\[conection_name:\s*(.*?)\]\s*,\s*\[conection_id:\s*(.*?)\]\s*,\s*\[contact_id:\s*CONTACT_ID\](?:\s*,\s*\[instabce_phone:\s*INSTANCE_PHONE\])?/);
  if (conexaoMatch) {
    console.log('✅ Match encontrado: transferir conexão');
    return {
      type: 'transferir_conexao',
      label: `Transferir Conexão: ${conexaoMatch[1]}`,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      values: { conection_name: conexaoMatch[1], conection_id: conexaoMatch[2] }
    };
  }

  // Transferir Fila
  const filaMatch = actionText.match(/\[ADD_ACTION\]:\s*\[fila_id:\s*(.*?)\]\s*,\s*\[contact_id:\s*CONTACT_ID\]\s*,\s*\[conversation_id:\s*CONVERSATION_ID\](?:\s*,\s*\[instabce_phone:\s*INSTANCE_PHONE\])?/);
  if (filaMatch) {
    console.log('✅ Match encontrado: transferir fila');
    return {
      type: 'transferir_fila',
      label: 'Transferir Fila',
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      values: { fila_id: filaMatch[1] }
    };
  }

  // Criar Card
  const criarCardMatch = actionText.match(/\[ADD_ACTION\]:\s*\[pipeline_id:\s*(.*?)\]\s*,\s*\[coluna_id:\s*(.*?)\]\s*,\s*\[contact_id:\s*CONTACT_ID\]\s*,\s*\[conversation_id:\s*CONVERSATION_ID\](?:\s*,\s*\[instabce_phone:\s*INSTANCE_PHONE\])?/);
  if (criarCardMatch) {
    console.log('✅ Match encontrado: criar card');
    return {
      type: 'criar_card',
      label: 'Criar Card no CRM',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      values: { pipeline_id: criarCardMatch[1], coluna_id: criarCardMatch[2] }
    };
  }

  // Salvar Informações Adicionais
  const salvarInfoMatch = actionText.match(/\[ADD_ACTION\]:\s*\[workspace_id:\s*WORKSPACE_ID\]\s*,\s*\[contact_id:\s*CONTACT_ID\]\s*,\s*\[field_name:\s*(.*?)\]\s*,\s*\[field_value:\s*(.*?)\]/);
  if (salvarInfoMatch) {
    console.log('✅ Match encontrado: salvar informações adicionais');
    return {
      type: 'salvar_informacoes',
      label: `Salvar campo ${salvarInfoMatch[1]}`,
      className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      values: { field_name: salvarInfoMatch[1], field_value: salvarInfoMatch[2] }
    };
  }

  console.log('❌ Nenhum match encontrado');
  return null;
}

function parseTextToNodes(text: string): EditorNode[] {
  const nodes: EditorNode[] = [];
  // Regex simplificada: captura [ADD_ACTION]: seguido de tudo até nova linha ou fim
  const actionRegex = /\[ADD_ACTION\]:[^\n]*/g;
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
    
    // A ação em si - sempre renderiza com destaque amarelo
    const actionText = match[0].trim();
    if (actionText) {
      nodes.push({ 
        type: 'action', 
        content: actionText,
        id: `action-${match.index}-${Math.random().toString(36).substr(2, 9)}`,
        actionType: 'action',
        label: actionText,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700'
      });
    }
    
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

export const RichPromptEditor = forwardRef<PromptEditorRef, RichPromptEditorProps>(({
  value,
  onChange,
  placeholder,
  className,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isInternalUpdateRef = useRef(false);

  const extractValueFromDOM = (): string => {
    if (!containerRef.current) return "";
    
    let result = "";
    const children = Array.from(containerRef.current.childNodes);
    
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent || "";
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        if (element.classList.contains('inline-flex') && element.hasAttribute('data-action')) {
          result += element.getAttribute('data-action') || "";
        } else {
          result += element.textContent || "";
        }
      }
    }
    
    return result;
  };

  const renderContent = (text: string) => {
    if (!containerRef.current) return;

    const selection = window.getSelection();
    let savedOffset = 0;
    let savedNode: Node | null = null;

    // Salva posição do cursor
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      savedNode = range.startContainer;
      savedOffset = range.startOffset;
    }
    
    // Limpa o conteúdo atual
    containerRef.current.innerHTML = "";
    
    const nodes = parseTextToNodes(text);
    
    nodes.forEach(node => {
      if (node.type === 'text') {
        const textNode = document.createTextNode(node.content);
        containerRef.current!.appendChild(textNode);
      } else {
        const badge = document.createElement('span');
        badge.setAttribute('contentEditable', 'false');
        badge.setAttribute('data-action', node.content);
        badge.setAttribute('data-action-id', node.id);
        badge.className = `inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono m-0.5 ${node.className}`;
        badge.style.userSelect = 'none';
        
        const textSpan = document.createElement('span');
        textSpan.textContent = node.label;
        badge.appendChild(textSpan);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors';
        removeBtn.tabIndex = -1;
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveAction(node.id);
        };
        badge.appendChild(removeBtn);
        
        containerRef.current!.appendChild(badge);
      }
    });
  };

  // Renderiza o conteúdo inicial e quando value muda externamente
  useEffect(() => {
    if (!containerRef.current) return;

    // Se for uma atualização interna, ignora
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    const currentText = extractValueFromDOM();
    const newValue = value || "";
    
    // Só atualiza se o valor externo for diferente do atual
    if (currentText !== newValue) {
      renderContent(newValue);
    }
  }, [value]);

  const handleRemoveAction = (actionId: string) => {
    if (!containerRef.current) return;
    
    const badge = containerRef.current.querySelector(`[data-action-id="${actionId}"]`);
    if (badge) {
      badge.remove();
      isInternalUpdateRef.current = true;
      onChange(extractValueFromDOM());
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

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // Se for uma ação, insere como badge
    if (text.startsWith('[ADD_ACTION]:')) {
      const actionDetails = parseActionDetails(text);
      const badge = document.createElement('span');
      const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      badge.setAttribute('contentEditable', 'false');
      badge.setAttribute('data-action', text);
      badge.setAttribute('data-action-id', actionId);
      badge.className = `inline-flex items-center gap-1 px-2 py-1 rounded-xl text-sm m-1 ${actionDetails?.className || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`;
      badge.style.userSelect = 'none';
      
      const textSpan = document.createElement('span');
      textSpan.textContent = actionDetails?.label || text;
      badge.appendChild(textSpan);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors';
      removeBtn.tabIndex = -1;
      removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
      removeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleRemoveAction(actionId);
      };
      badge.appendChild(removeBtn);
      
      range.insertNode(badge);
      range.setStartAfter(badge);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Insere texto normal
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    isInternalUpdateRef.current = true;
    onChange(extractValueFromDOM());
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
  }));

  const handleContainerInput = () => {
    isInternalUpdateRef.current = true;
    onChange(extractValueFromDOM());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertText('\n');
    }
  };

  return (
    <div
      ref={containerRef}
      contentEditable
      suppressContentEditableWarning
      suppressHydrationWarning
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
  );
});

RichPromptEditor.displayName = "RichPromptEditor";
