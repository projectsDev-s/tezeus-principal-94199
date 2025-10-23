import React, { useState, useRef, useEffect } from "react";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position?: number;
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string, badges: ActionBadge[]) => void;
  badges: ActionBadge[];
  onBadgeClick?: (badge: ActionBadge) => void;
  placeholder?: string;
  className?: string;
}

export function PromptEditor({
  value,
  onChange,
  badges,
  onBadgeClick,
  placeholder,
  className,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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
      if (node.parentElement?.getAttribute("data-badge-id")) continue;
      textNodes.push(node.textContent || "");
    }
    
    const textContent = textNodes.join("");
    onChange(textContent, badges);
  };

  const handleRemoveBadge = (badgeId: string) => {
    const updatedBadges = badges.filter((b) => b.id !== badgeId);
    onChange(value, updatedBadges);
  };

  const handleBadgeClick = (badge: ActionBadge) => {
    onBadgeClick?.(badge);
  };

  // Render content with badges inline
  useEffect(() => {
    if (!editorRef.current || isFocused) return;

    const container = editorRef.current;
    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    
    container.innerHTML = "";

    // Add text content first
    if (value) {
      const lines = value.split("\n");
      lines.forEach((line, index) => {
        if (index > 0) {
          container.appendChild(document.createElement("br"));
        }
        container.appendChild(document.createTextNode(line));
      });
    }

    // Add a space before badges if there's text
    if (value && badges.length > 0) {
      container.appendChild(document.createTextNode(" "));
    }
    
    // Add badges at the end
    badges.forEach((badge, idx) => {
      // Add space between badges
      if (idx > 0) {
        container.appendChild(document.createTextNode(" "));
      }
      
      // Create inline badge
      const badgeElement = document.createElement("span");
      badgeElement.setAttribute("data-badge-id", badge.id);
      badgeElement.contentEditable = "false";
      badgeElement.draggable = true;
      badgeElement.style.display = "inline-flex";
      badgeElement.style.alignItems = "center";
      badgeElement.style.gap = "1px";
      badgeElement.style.padding = "0px 3px";
      badgeElement.style.fontSize = "15px";
      badgeElement.style.borderRadius = "3px";
      badgeElement.style.backgroundColor = "hsl(var(--primary) / 0.7)";
      badgeElement.style.color = "hsl(var(--primary-foreground))";
      badgeElement.style.cursor = "move";
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

      // Drag and drop handlers
      badgeElement.addEventListener("dragstart", (e) => {
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", badge.id);
        badgeElement.style.opacity = "0.5";
      });

      badgeElement.addEventListener("dragend", (e) => {
        badgeElement.style.opacity = "1";
      });

      badgeElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
      });

      badgeElement.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer!.getData("text/plain");
        if (draggedId !== badge.id) {
          const draggedIndex = badges.findIndex(b => b.id === draggedId);
          const targetIndex = badges.findIndex(b => b.id === badge.id);
          
          if (draggedIndex !== -1 && targetIndex !== -1) {
            const newBadges = [...badges];
            const [draggedBadge] = newBadges.splice(draggedIndex, 1);
            newBadges.splice(targetIndex, 0, draggedBadge);
            onChange(value, newBadges);
          }
        }
      });
      
      container.appendChild(badgeElement);
    });

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
        onBlur={() => setIsFocused(false)}
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
        <div className="absolute top-4 left-4 pointer-events-none text-muted-foreground text-sm font-mono">
          {placeholder}
        </div>
      )}
    </div>
  );
}
