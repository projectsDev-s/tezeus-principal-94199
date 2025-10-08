import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";

interface MessageSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onForward: () => void;
}

export function MessageSelectionBar({ selectedCount, onCancel, onForward }: MessageSelectionBarProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-lg z-10">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="font-medium">
          {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onForward}
        className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
        disabled={selectedCount === 0}
      >
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
