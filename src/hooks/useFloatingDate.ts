import { useState, useEffect, useCallback, RefObject } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UseFloatingDateReturn {
  floatingDate: string | null;
  shouldShowFloating: boolean;
}

export function useFloatingDate(
  scrollRef: RefObject<HTMLElement>,
  messages: any[]
): UseFloatingDateReturn {
  const [floatingDate, setFloatingDate] = useState<string | null>(null);
  const [shouldShowFloating, setShouldShowFloating] = useState(false);

  const formatDateLabel = useCallback((date: Date): string => {
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    
    // Se for da mesma semana, mostrar dia da semana
    const daysDiff = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return format(date, 'EEEE', { locale: ptBR });
    }
    
    // Caso contrário, mostrar data completa
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || messages.length === 0) {
      setShouldShowFloating(false);
      return;
    }

    const scrollContainer = scrollRef.current;
    const scrollTop = scrollContainer.scrollTop;
    const containerRect = scrollContainer.getBoundingClientRect();
    
    // Encontrar o separador de data mais visível no viewport
    const dateSeparators = scrollContainer.querySelectorAll('[data-date-separator]');
    let visibleDate: string | null = null;
    let closestToTop = Infinity;
    
    dateSeparators.forEach((separator) => {
      const rect = separator.getBoundingClientRect();
      const separatorTop = rect.top - containerRect.top;
      
      // Verificar se o separador está dentro ou próximo do viewport
      if (separatorTop >= -50 && separatorTop <= containerRect.height) {
        const distanceFromTop = Math.abs(separatorTop);
        
        if (distanceFromTop < closestToTop) {
          closestToTop = distanceFromTop;
          visibleDate = separator.getAttribute('data-date-separator');
        }
      }
    });
    
    // Verificar se o separador está muito próximo do topo (visível)
    const isDateSeparatorVisible = closestToTop < 80;
    
    if (scrollTop > 100 && !isDateSeparatorVisible && visibleDate) {
      setFloatingDate(visibleDate);
      setShouldShowFloating(true);
    } else {
      setShouldShowFloating(false);
    }
  }, [scrollRef, messages]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', handleScroll);
    
    // Verificar inicialmente
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef, handleScroll]);

  return {
    floatingDate,
    shouldShowFloating
  };
}

// Função auxiliar para formatar data de mensagem
export function formatMessageDate(date: Date | string): string {
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(messageDate)) return 'Hoje';
  if (isYesterday(messageDate)) return 'Ontem';
  
  const daysDiff = Math.floor((new Date().getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return format(messageDate, 'EEEE', { locale: ptBR });
  }
  
  return format(messageDate, 'dd/MM/yyyy', { locale: ptBR });
}

// Função para agrupar mensagens por data
export function groupMessagesByDate(messages: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  
  messages.forEach(message => {
    const messageDate = new Date(message.created_at);
    const dateKey = format(messageDate, 'yyyy-MM-dd');
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(message);
  });
  
  return grouped;
}
