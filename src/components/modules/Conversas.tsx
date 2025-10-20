// Novo componente de conversas WhatsApp
import { WhatsAppChat } from './WhatsAppChat';
import { useWorkspaceStatusCheck } from '@/hooks/useWorkspaceStatusCheck';

interface ConversasProps {
  isDarkMode?: boolean;
  selectedConversationId?: string | null;
}

export function Conversas({ isDarkMode = false, selectedConversationId }: ConversasProps) {
  // Monitorar status do workspace
  useWorkspaceStatusCheck();
  
  return <WhatsAppChat isDarkMode={isDarkMode} selectedConversationId={selectedConversationId} />;
}