import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number;
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface PromptEditorRef {
  getCursorPosition: () => number;
  insertText: (text: string) => void;
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(({
  value,
  onChange,
  placeholder,
  className,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const getCursorPosition = (): number => {
    if (!textareaRef.current) return 0;
    return textareaRef.current.selectionStart;
  };

  const insertText = (text: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    // Inserir texto na posição do cursor
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    
    onChange(newValue);

    // Mover cursor para depois do texto inserido
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = start + text.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
  }));

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(
        "w-full min-h-[400px] p-4 rounded-md border border-input bg-background",
        "font-mono text-sm resize-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "placeholder:text-muted-foreground",
        className
      )}
    />
  );
});
