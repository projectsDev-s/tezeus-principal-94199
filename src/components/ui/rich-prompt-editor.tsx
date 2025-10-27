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
  | { type: 'action', content: string, id: string };

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
    
    // A ação em si
    nodes.push({ 
      type: 'action', 
      content: match[0],
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
        badge.className = 'inline-flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium mx-0.5 border border-primary/20';
        badge.style.userSelect = 'none';
        
        const textSpan = document.createElement('span');
        textSpan.textContent = node.content;
        badge.appendChild(textSpan);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors';
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
      const badge = document.createElement('span');
      const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      badge.setAttribute('contentEditable', 'false');
      badge.setAttribute('data-action', text);
      badge.setAttribute('data-action-id', actionId);
      badge.className = 'inline-flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium mx-0.5 border border-primary/20';
      badge.style.userSelect = 'none';
      
      const textSpan = document.createElement('span');
      textSpan.textContent = text;
      badge.appendChild(textSpan);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors';
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
