import { X, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppMessage {
  id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender_type: 'contact' | 'agent';
  file_url?: string;
  file_name?: string;
}

interface ReplyPreviewProps {
  message: WhatsAppMessage;
  contactName: string;
  onCancel: () => void;
}

export function ReplyPreview({ message, contactName, onCancel }: ReplyPreviewProps) {
  const getSenderName = () => {
    return message.sender_type === 'contact' ? contactName : 'Você';
  };

  const getPreviewContent = () => {
    if (message.message_type === 'text') {
      return message.content.length > 50 
        ? message.content.substring(0, 50) + '...' 
        : message.content;
    }
    
    const typeLabels = {
      image: '📷 Imagem',
      video: '🎥 Vídeo',
      audio: '🎵 Áudio',
      document: '📄 Documento'
    };
    
    return typeLabels[message.message_type] || message.content;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-l-4 border-primary">
      <Reply className="h-4 w-4 text-primary flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          {getSenderName()}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {getPreviewContent()}
        </p>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-6 w-6 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
