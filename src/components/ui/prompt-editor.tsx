import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number; // posição no texto onde o badge deve aparecer
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string, badges: ActionBadge[]) => void;
  badges: ActionBadge[];
  onBadgeClick?: (badge: ActionBadge) => void;
  placeholder?: string;
  className?: string;
}

export interface PromptEditorRef {
  getCursorPosition: () => number;
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(({
  value,
  onChange,
  badges,
  onBadgeClick,
  placeholder,
  className,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const cursorPositionRef = useRef<number>(0);

  // Salva a posição do cursor
  const saveCursorPosition = () => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    // Conta apenas o texto, ignorando badges
    let position = 0;
    const contents = preCaretRange.cloneContents();
    const walker = document.createTreeWalker(
      contents,
      NodeFilter.SHOW_ALL,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      // Ignorar badges
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.getAttribute("data-badge-id")) {
          continue;
        }
        // Contar <br> como quebra de linha
        if (element.tagName === "BR") {
          position += 1;
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Verificar se NÃO está dentro de badge
        let parent = node.parentElement;
        let isBadge = false;
        while (parent && parent !== editorRef.current) {
          if (parent.getAttribute?.("data-badge-id")) {
            isBadge = true;
            break;
          }
          parent = parent.parentElement;
        }
        
        if (!isBadge) {
          position += node.textContent?.length || 0;
        }
      }
    }
    
    cursorPositionRef.current = position;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');
    
    // Insert at cursor maintaining line breaks
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    selection.deleteFromDocument();
    
    // Split by lines and insert with <br>
    const lines = text.split('\n');
    const range = selection.getRangeAt(0);
    
    lines.forEach((line, index) => {
      if (index > 0) {
        const br = document.createElement('br');
        range.insertNode(br);
        range.collapse(false);
      }
      const textNode = document.createTextNode(line);
      range.insertNode(textNode);
      range.collapse(false);
    });
    
    // Manually trigger handleInput
    handleInput();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    
    // Extract text content preserving line breaks (<br> elements)
    let textContent = "";
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_ALL,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      // Ignore badges
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.getAttribute("data-badge-id")) {
          // Skip badge and its children
          walker.nextSibling();
          continue;
        }
        
        // Preserve <br> as line break
        if (element.tagName === "BR") {
          textContent += "\n";
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Check if not inside a badge
        let parent = node.parentElement;
        let isBadge = false;
        while (parent && parent !== editorRef.current) {
          if (parent.getAttribute("data-badge-id")) {
            isBadge = true;
            break;
          }
          parent = parent.parentElement;
        }
        
        if (!isBadge) {
          textContent += node.textContent || "";
        }
      }
    }
    
    // Do NOT apply .trim() - preserve formatting
    onChange(textContent, badges);
  };

  const handleRemoveBadge = (badgeId: string) => {
    const updatedBadges = badges.filter((b) => b.id !== badgeId);
    onChange(value, updatedBadges);
  };

  const handleBadgeClick = (badge: ActionBadge) => {
    onBadgeClick?.(badge);
  };

  // Expõe a posição do cursor para uso externo via ref
  useImperativeHandle(ref, () => ({
    getCursorPosition: () => cursorPositionRef.current,
  }));

  // Render content with badges inline at their positions
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Only skip rendering if focused AND there's already content
    if (isFocused && editorRef.current.textContent?.length > 0) return;

    const container = editorRef.current;
    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    
    container.innerHTML = "";

    const content = value || "";
    
    // Ordena badges por posição
    const sortedBadges = [...badges].sort((a, b) => a.position - b.position);
    
    let lastIndex = 0;
    
    sortedBadges.forEach((badge) => {
      // Adiciona texto antes do badge
      if (badge.position > lastIndex) {
        const textBefore = content.substring(lastIndex, badge.position);
        const lines = textBefore.split("\n");
        lines.forEach((line, index) => {
          if (index > 0) {
            container.appendChild(document.createElement("br"));
          }
          // Always add text node, even if empty (preserves formatting)
          container.appendChild(document.createTextNode(line));
        });
      }
      
      // Cria o badge
      const badgeElement = document.createElement("span");
      badgeElement.setAttribute("data-badge-id", badge.id);
      badgeElement.contentEditable = "false";
      badgeElement.style.display = "inline-flex";
      badgeElement.style.alignItems = "center";
      badgeElement.style.gap = "1px";
      badgeElement.style.padding = "0px 3px";
      badgeElement.style.fontSize = "15px";
      badgeElement.style.borderRadius = "3px";
      badgeElement.style.backgroundColor = "hsl(var(--primary) / 0.7)";
      badgeElement.style.color = "hsl(var(--primary-foreground))";
      badgeElement.style.cursor = "pointer";
      badgeElement.style.verticalAlign = "middle";
      badgeElement.style.margin = "0 1px";
      badgeElement.style.maxWidth = "250px";
      badgeElement.style.overflow = "hidden";
      
      badgeElement.innerHTML = `
        <svg style="width: 8px; height: 8px; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="5" r="1"></circle>
          <circle cx="9" cy="12" r="1"></circle>
          <circle cx="9" cy="19" r="1"></circle>
          <circle cx="15" cy="5" r="1"></circle>
          <circle cx="15" cy="12" r="1"></circle>
          <circle cx="15" cy="19" r="1"></circle>
        </svg>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; display: inline-block;">${badge.label}</span>
        <button style="padding: 0px; border-radius: 50%; background: transparent; flex-shrink: 0;" data-remove="${badge.id}">
          <svg style="width: 8px; height: 8px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      `;
      
      badgeElement.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (target.closest("[data-remove]")) {
          handleRemoveBadge(badge.id);
        } else {
          handleBadgeClick(badge);
        }
      });
      
      container.appendChild(badgeElement);
      lastIndex = badge.position;
    });
    
    // Adiciona o texto restante depois do último badge
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex);
      const lines = textAfter.split("\n");
      lines.forEach((line, index) => {
        if (index > 0) {
          container.appendChild(document.createElement("br"));
        }
        // Always add text node, even if empty (preserves formatting)
        container.appendChild(document.createTextNode(line));
      });
    }

    // Restore cursor position
    if (savedRange) {
      try {
        selection?.removeAllRanges();
        selection?.addRange(savedRange);
      } catch (e) {
        // Ignore errors restoring selection
      }
    }
  }, [badges, value]);

  return (
    <div
      className={cn(
        "relative min-h-[400px] rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          saveCursorPosition();
        }}
        onClick={saveCursorPosition}
        onKeyUp={saveCursorPosition}
        className={cn(
          "min-h-[400px] p-4 outline-none font-mono",
          "break-words",
          !value && !isFocused && badges.length === 0 && "text-muted-foreground"
        )}
        suppressContentEditableWarning
      >
        {/* Content will be rendered via useEffect */}
      </div>

      {/* Placeholder */}
      {!value && !isFocused && badges.length === 0 && (
        <div className="absolute top-4 left-4 pointer-events-none text-sm font-mono">
          {placeholder}
        </div>
      )}
    </div>
  );
});
