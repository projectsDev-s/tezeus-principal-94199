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
    const walker = document.createTreeWalker(
      preCaretRange.cloneContents(),
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      position += node.textContent?.length || 0;
    }
    
    cursorPositionRef.current = position;
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    
    // Extract only text content, ignoring badge elements
    const textNodes: string[] = [];
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      // Check if ANY ancestor has data-badge-id (not just direct parent)
      let parent = node.parentElement;
      let isBadge = false;
      while (parent && parent !== editorRef.current) {
        if (parent.getAttribute("data-badge-id")) {
          isBadge = true;
          break;
        }
        parent = parent.parentElement;
      }
      
      if (isBadge) continue;
      textNodes.push(node.textContent || "");
    }
    
    const textContent = textNodes.join("").trim();
    
    // Se o texto estiver vazio, limpar badges também
    if (textContent === "") {
      onChange("", []);
    } else {
      onChange(textContent, badges);
    }
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
    if (!editorRef.current || isFocused) return;

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
          if (line) {
            container.appendChild(document.createTextNode(line));
          }
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
      
      badgeElement.innerHTML = `
        <svg style="width: 8px; height: 8px; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="5" r="1"></circle>
          <circle cx="9" cy="12" r="1"></circle>
          <circle cx="9" cy="19" r="1"></circle>
          <circle cx="15" cy="5" r="1"></circle>
          <circle cx="15" cy="12" r="1"></circle>
          <circle cx="15" cy="19" r="1"></circle>
        </svg>
        <span style="white-space: nowrap;">${badge.label}</span>
        <button style="padding: 0px; border-radius: 50%; background: transparent;" data-remove="${badge.id}">
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
        if (line) {
          container.appendChild(document.createTextNode(line));
        }
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
