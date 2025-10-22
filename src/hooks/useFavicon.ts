import { useEffect } from 'react';

export function useFavicon(faviconUrl?: string) {
  useEffect(() => {
    if (!faviconUrl) return;

    // Remove existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());
    
    // Add new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = faviconUrl;
    document.head.appendChild(link);
  }, [faviconUrl]);
}
