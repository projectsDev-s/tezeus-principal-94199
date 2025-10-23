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

    // Insert badges first
    badges.forEach((badge) => {
      const badgeElement = document.createElement("span");
      badgeElement.setAttribute("data-badge-id", badge.id);
      badgeElement.contentEditable = "false";
      badgeElement.className = "inline-flex align-baseline mx-1";
      
      const badgeContent = document.createElement("div");
      badgeContent.className = cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-0 text-[9px] font-medium transition-colors",
        "border-transparent bg-primary/70 text-primary-foreground hover:bg-primary/90 cursor-pointer"
      );
      
      badgeContent.innerHTML = `
        <svg class="h-1.5 w-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="5" r="1"></circle>
          <circle cx="9" cy="12" r="1"></circle>
          <circle cx="9" cy="19" r="1"></circle>
          <circle cx="15" cy="5" r="1"></circle>
          <circle cx="15" cy="12" r="1"></circle>
          <circle cx="15" cy="19" r="1"></circle>
        </svg>
        <span class="text-[9px] whitespace-nowrap">${badge.label}</span>
        <button class="rounded-full p-0 hover:bg-primary-foreground/20 transition-colors" data-remove="${badge.id}">
          <svg class="h-1.5 w-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      `;
      
      badgeContent.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (target.closest("[data-remove]")) {
          handleRemoveBadge(badge.id);
        } else {
          handleBadgeClick(badge);
        }
      });
      
      badgeElement.appendChild(badgeContent);
      container.appendChild(badgeElement);
      
      // Add space after badge
      container.appendChild(document.createTextNode(" "));
    });

    // Add text content
    if (value) {
      const lines = value.split("\n");
      lines.forEach((line, index) => {
        if (index > 0) {
          container.appendChild(document.createElement("br"));
        }
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
  }, [badges]);

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
          "min-h-[400px] p-4 outline-none font-mono text-sm",
          "whitespace-pre-wrap break-words",
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
