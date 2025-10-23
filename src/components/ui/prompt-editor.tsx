import React, { useState, useRef, useEffect } from "react";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function SortableBadge({
  badge,
  onRemove,
  onClick,
}: {
  badge: ActionBadge;
  onRemove: () => void;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: badge.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Badge
        variant="secondary"
        className={cn(
          "px-2 py-1 cursor-pointer transition-all text-xs",
          "bg-primary/80 text-primary-foreground hover:bg-primary",
          "flex items-center gap-1.5 group"
        )}
        onClick={onClick}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3" />
        </div>
        <span className="text-xs font-medium">{badge.label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-primary-foreground/20 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </Badge>
    </div>
  );
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = badges.findIndex((b) => b.id === active.id);
      const newIndex = badges.findIndex((b) => b.id === over.id);

      const reorderedBadges = arrayMove(badges, oldIndex, newIndex);
      onChange(value, reorderedBadges);
    }
  };

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
      {/* Integrated Editor with Badges and Text */}
      <div className="min-h-[400px] p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={badges.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-2 items-start">
              {badges.map((badge, index) => (
                <React.Fragment key={badge.id}>
                  <SortableBadge
                    badge={badge}
                    onRemove={() => handleRemoveBadge(badge.id)}
                    onClick={() => handleBadgeClick(badge)}
                  />
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Text Editor */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "mt-2 min-h-[320px] outline-none font-mono text-sm",
            "whitespace-pre-wrap break-words",
            !value && !isFocused && "text-muted-foreground"
          )}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />

        {/* Placeholder */}
        {!value && !isFocused && badges.length === 0 && (
          <div className="absolute top-4 left-4 pointer-events-none text-muted-foreground text-sm font-mono">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

