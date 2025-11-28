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
          className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1 h-5 w-5 p-0 z-[999] rounded-none bg-white/80 hover:bg-white border border-transparent hover:border-[#d4d4d4] shadow-sm"
        >
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white z-[999] rounded-none border-[#d4d4d4]">
        <DropdownMenuItem onClick={onForward} className="cursor-pointer rounded-none focus:bg-[#e6f2ff] text-xs">
          <Forward className="h-3.5 w-3.5 mr-2 text-gray-500" />
          Encaminhar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReply} className="cursor-pointer rounded-none focus:bg-[#e6f2ff] text-xs">
          <Reply className="h-3.5 w-3.5 mr-2 text-gray-500" />
          Responder
        </DropdownMenuItem>
        {hasDownload && onDownload && (
          <DropdownMenuItem onClick={onDownload} className="cursor-pointer rounded-none focus:bg-[#e6f2ff] text-xs">
            <Download className="h-3.5 w-3.5 mr-2 text-gray-500" />
            Download
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
