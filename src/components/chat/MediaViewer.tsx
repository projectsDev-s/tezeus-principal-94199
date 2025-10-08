import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertCircle, Loader2, Eye } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { WhatsAppAudioPlayer } from './WhatsAppAudioPlayer';
import { ImageModal } from './ImageModal';
import { PdfModal } from './PdfModal';
import { VideoModal } from './VideoModal';

interface MediaViewerProps {
  fileUrl: string;
  fileName?: string;
  messageType: string;
  className?: string;
  senderType?: 'agent' | 'contact';
  senderAvatar?: string;
  senderName?: string;
  messageStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  metadata?: {
    waveform?: Record<string, number>;
    duration_seconds?: number;
  };
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  fileUrl,
  fileName,
  messageType,
  className = '',
  senderType = 'contact',
  senderAvatar,
  senderName,
  messageStatus,
  timestamp,
  metadata,
}) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Log para debug
  console.log('🟡 MediaViewer render:', { 
    fileUrl, 
    fileName, 
    messageType,
    detectionsAfterPriority: {
      isAudioFile: messageType === 'audio' || /\.(mp3|wav|ogg|aac|flac|webm|m4a|opus)$/i.test(fileName || fileUrl || ''),
      isPdfFile: messageType === 'document' || /\.pdf$/i.test(fileName || fileUrl || ''),
      isImageFile: messageType === 'image',
      isVideoFile: messageType === 'video'
    }
  });

  // Detectar tipos de arquivos - PRIORIZAR messageType
  const isAudioFile = messageType === 'audio' ||
                      (messageType !== 'document' && messageType !== 'image' && messageType !== 'video' && 
                       /\.(mp3|wav|ogg|aac|flac|webm|m4a|opus)$/i.test(fileName || fileUrl || ''));
                       
  const isPdfFile = messageType === 'document' || 
                    (messageType !== 'audio' && messageType !== 'image' && messageType !== 'video' &&
                     (/\.pdf$/i.test(fileName || '') || /\.pdf$/i.test(fileUrl) || 
                      fileName?.toLowerCase().includes('pdf') || fileUrl?.toLowerCase().includes('pdf')));
                      
  const isImageFile = messageType === 'image' ||
                      (messageType !== 'audio' && messageType !== 'document' && messageType !== 'video' &&
                       /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || fileUrl || ''));
                       
  const isVideoFile = messageType === 'video' ||
                      (messageType !== 'audio' && messageType !== 'document' && messageType !== 'image' &&
                       /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(fileName || fileUrl || ''));
                       
  const isExcelFile = /\.(xlsx|xls)$/i.test(fileName || '') || /\.(xlsx|xls)$/i.test(fileUrl);
  const isWordFile = /\.(docx|doc)$/i.test(fileName || '') || /\.(docx|doc)$/i.test(fileUrl);
  const isPowerPointFile = /\.(pptx|ppt)$/i.test(fileName || '') || /\.(pptx|ppt)$/i.test(fileUrl);

  // Log específico para detecções
  console.log('🔍 DETECÇÃO FINAL:', {
    fileName,
    fileUrl,
    messageType,
    finalDetections: {
      isAudioFile,
      isPdfFile,
      isImageFile,
      isVideoFile
    },
    priorityUsed: 'messageType tem prioridade sobre extensão'
  });

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Image load error:', fileUrl);
    setImageError('Erro ao carregar imagem');
    setIsLoading(false);
  }, [fileUrl]);

  // PRIMEIRA VERIFICAÇÃO: PDF
  if (isPdfFile) {
    console.log('🔴 RENDERIZANDO PDF:', { fileName, fileUrl, messageType, extension: fileName?.split('.').pop()?.toLowerCase() });
    return (
      <div className={className}>
        <div className="relative group">
          <div 
            className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-red-300" 
            onClick={() => setIsPdfModalOpen(true)}
          >
            <div className="relative">
              <FileText className="h-12 w-12 text-red-600" />
              <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1 rounded font-medium">
                PDF
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Documento PDF'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Clique para visualizar
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <PdfModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          pdfUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // SEGUNDA VERIFICAÇÃO: IMAGEM
  if (isImageFile || messageType === 'image') {
    return (
      <div className={className}>
        <div className="relative">
          {isLoading && !hasLoaded && (
            <div className="flex items-center justify-center max-w-[300px] max-h-[200px] rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20">
              <div className="flex flex-col items-center gap-2 p-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Carregando imagem...</p>
              </div>
            </div>
          )}
          
          {!imageError && (
            <img
              src={fileUrl}
              alt={fileName || 'Imagem'}
              className={`max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer transition-opacity duration-200 ${
                isLoading && !hasLoaded ? 'opacity-0 absolute' : 'opacity-100'
              }`}
              onClick={() => setIsImageModalOpen(true)}
              onError={handleImageError}
              onLoad={() => {
                setImageError(null);
                setIsLoading(false);
                setHasLoaded(true);
              }}
              onLoadStart={() => {
                setIsLoading(true);
                setHasLoaded(false);
              }}
              loading="lazy"
            />
          )}
          
          {imageError && (
            <div 
              className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-destructive/20"
              onClick={handleDownload}
            >
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-destructive">
                  Erro ao carregar - Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          )}
        </div>
        
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // TERCEIRA VERIFICAÇÃO: VÍDEO
  if (isVideoFile || messageType === 'video') {
    return (
      <div className={className}>
        <div className="relative max-w-[300px]">
          <video
            src={fileUrl}
            controls
            className="w-full rounded-lg cursor-pointer"
            style={{ maxHeight: '200px' }}
            onClick={() => setIsVideoModalOpen(true)}
          >
            Seu navegador não suporta o elemento de vídeo.
          </video>
        </div>
        
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // QUARTA VERIFICAÇÃO: ÁUDIO
  if (isAudioFile || messageType === 'audio') {
    return (
      <div className={className}>
        <WhatsAppAudioPlayer
          audioUrl={fileUrl}
          fileName={fileName}
          senderType={senderType}
          senderAvatar={senderAvatar}
          senderName={senderName}
          messageStatus={messageStatus}
          timestamp={timestamp}
          onDownload={handleDownload}
          metadata={metadata}
        />
      </div>
    );
  }

  // QUINTA VERIFICAÇÃO: OUTROS ARQUIVOS
  if (isExcelFile) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-green-300" 
             onClick={handleDownload}>
          <div className="relative">
            <FileText className="h-12 w-12 text-green-600" />
            <div className="absolute -top-1 -right-1 bg-green-600 text-white text-xs px-1 rounded font-medium">
              XLS
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {fileName || 'Planilha Excel'}
            </p>
            <p className="text-xs text-muted-foreground">
              Clique para baixar
            </p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isWordFile) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-primary/30" 
             onClick={handleDownload}>
          <div className="relative">
            <FileText className="h-12 w-12 text-primary" />
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-1 rounded font-medium">
              DOC
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {fileName || 'Documento Word'}
            </p>
            <p className="text-xs text-muted-foreground">
              Clique para baixar
            </p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isPowerPointFile) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-orange-300" 
             onClick={handleDownload}>
          <div className="relative">
            <FileText className="h-12 w-12 text-orange-600" />
            <div className="absolute -top-1 -right-1 bg-orange-600 text-white text-xs px-1 rounded font-medium">
              PPT
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {fileName || 'Apresentação PowerPoint'}
            </p>
            <p className="text-xs text-muted-foreground">
              Clique para baixar
            </p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // PADRÃO: ARQUIVO GENÉRICO
  return (
    <div className={className}>
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-gray-300" 
           onClick={handleDownload}>
        <div className="relative">
          <FileText className="h-12 w-12 text-gray-600" />
          <div className="absolute -top-1 -right-1 bg-gray-600 text-white text-xs px-1 rounded font-medium">
            FILE
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {fileName || 'Arquivo'}
          </p>
          <p className="text-xs text-muted-foreground">
            Clique para baixar
          </p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
};