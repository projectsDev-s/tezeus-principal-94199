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
  const actionRegex = /(\[[^\]]+\])/g;
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
  const [nodes, setNodes] = useState<EditorNode[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  // Parse value to nodes quando o valor mudar
  useEffect(() => {
    setNodes(parseTextToNodes(value || ""));
  }, [value]);


  const handleRemoveAction = (actionId: string) => {
    const updatedNodes = nodes.filter(node => 
      !(node.type === 'action' && node.id === actionId)
    );
    
    const newText = nodesToText(updatedNodes);
    onChange(newText);
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

    const position = getCursorPosition();
    const currentText = value || "";
    const newValue = currentText.substring(0, position) + text + currentText.substring(position);
    
    onChange(newValue);

    // Mover cursor para depois do texto inserido
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.focus();
        
        const selection = window.getSelection();
        const range = document.createRange();
        
        let charCount = 0;
        let targetNode: Node | null = null;
        let targetOffset = 0;
        const newPosition = position + text.length;
        
        const walker = document.createTreeWalker(
          containerRef.current,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const nodeLength = node.textContent?.length || 0;
          
          if (charCount + nodeLength >= newPosition) {
            targetNode = node;
            targetOffset = newPosition - charCount;
            break;
          }
          
          charCount += nodeLength;
        }
        
        if (targetNode && selection) {
          range.setStart(targetNode, targetOffset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }, 0);
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
  }));

  const handleContainerInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent || "";
    onChange(newText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Permitir navegação e edição normal
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
      onInput={handleContainerInput}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "w-full min-h-[400px] p-4 rounded-md border border-input bg-background",
        "text-sm resize-none overflow-y-auto",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isFocused && nodes.length === 0 && !value && "before:content-[attr(data-placeholder)] before:text-muted-foreground before:pointer-events-none",
        className
      )}
      data-placeholder={placeholder}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    >
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return <span key={`text-${index}`}>{node.content}</span>;
        } else {
          return (
            <span
              key={node.id}
              contentEditable={false}
              className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium mx-0.5 border border-primary/20"
              style={{ userSelect: 'none' }}
            >
              <span>{node.content}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveAction(node.id);
                }}
                className="hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors"
                tabIndex={-1}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        }
      })}
    </div>
  );
});

RichPromptEditor.displayName = "RichPromptEditor";
