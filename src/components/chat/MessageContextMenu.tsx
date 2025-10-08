import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Forward, Reply, Download } from "lucide-react";

interface MessageContextMenuProps {
  onForward: () => void;
  onReply: () => void;
  onDownload?: () => void;
  hasDownload?: boolean;
}

export function MessageContextMenu({ 
  onForward, 
  onReply, 
  onDownload,
  hasDownload = false 
}: MessageContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1 h-6 w-6 p-0"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover">
        <DropdownMenuItem onClick={onForward} className="cursor-pointer">
          <Forward className="h-4 w-4 mr-2" />
          Encaminhar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReply} className="cursor-pointer">
          <Reply className="h-4 w-4 mr-2" />
          Responder
        </DropdownMenuItem>
        {hasDownload && onDownload && (
          <DropdownMenuItem onClick={onDownload} className="cursor-pointer">
            <Download className="h-4 w-4 mr-2" />
            Download
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
