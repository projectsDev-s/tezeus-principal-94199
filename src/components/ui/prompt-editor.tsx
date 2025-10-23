import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
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

  const handleTextChange = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || "";
    onChange(text, badges);
  };

  const handleRemoveBadge = (badgeId: string) => {
    const updatedBadges = badges.filter((b) => b.id !== badgeId);
    onChange(value, updatedBadges);
  };

  const handleBadgeClick = (badge: ActionBadge) => {
    onBadgeClick?.(badge);
  };

  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.textContent = value;
    }
  }, [value, isFocused]);

  return (
    <div
      className={cn(
        "relative min-h-[400px] rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      {/* Badges Container */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border-b border-border bg-muted/20">
          {badges.map((badge) => (
            <Badge
              key={badge.id}
              variant="secondary"
              className={cn(
                "px-3 py-1.5 cursor-pointer transition-all",
                "bg-primary/80 text-primary-foreground hover:bg-primary",
                "flex items-center gap-2 group"
              )}
              onClick={() => handleBadgeClick(badge)}
            >
              <span className="text-sm font-medium">{badge.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveBadge(badge.id);
                }}
                className="ml-1 rounded-full p-0.5 hover:bg-primary-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Text Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleTextChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "min-h-[350px] p-4 outline-none font-mono text-sm",
          "whitespace-pre-wrap break-words",
          !value && !isFocused && "text-muted-foreground"
        )}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Placeholder */}
      {!value && !isFocused && (
        <div className="absolute top-[60px] left-4 pointer-events-none text-muted-foreground text-sm font-mono">
          {placeholder}
        </div>
      )}
    </div>
  );
}
