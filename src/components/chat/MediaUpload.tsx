import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Paperclip, Image, FileText, Music, Video, Upload, X, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Formatos permitidos por tipo de mídia
const ALLOWED_FORMATS = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime'], // .mp4 e .mov
  audio: ['audio/mpeg', 'audio/wav', 'audio/webm'],
  document: ['application/pdf', 'application/octet-stream']
};

// Nomes amigáveis para exibir ao usuário
const FORMAT_NAMES: Record<string, string> = {
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/webm': 'WebM (áudio)',
  'application/pdf': 'PDF'
};

interface MediaUploadProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document', fileUrl: string, caption?: string) => void;
  disabled?: boolean;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onFileSelect, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{
    file: File;
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    previewUrl: string;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFileType = (file: File, mediaType: 'image' | 'video' | 'audio' | 'document'): boolean => {
    const allowedTypes = ALLOWED_FORMATS[mediaType];
    
    if (!allowedTypes.includes(file.type)) {
      // Obter lista de formatos permitidos em formato amigável
      const allowedNames = allowedTypes
        .map(type => FORMAT_NAMES[type] || type)
        .join(', ');
      
      const mediaTypeLabel = mediaType === 'video' ? 'vídeo' : 
                              mediaType === 'image' ? 'imagem' : 
                              mediaType === 'audio' ? 'áudio' : 'documento';
      
      toast.error('Formato não suportado', {
        description: `Formatos de ${mediaTypeLabel} permitidos: ${allowedNames}`,
        duration: 4000,
        dismissible: true,
        closeButton: true
      });
      
      return false;
    }
    
    return true;
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'audio' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ✅ VALIDAR FORMATO
    if (!validateFileType(file, mediaType)) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // ✅ Criar preview LOCAL (SEM upload ainda)
    const previewUrl = URL.createObjectURL(file);

    // ✅ Preparar estado para preview
    setPendingMedia({
      file,
      type: mediaType,
      url: '', // URL será preenchida após upload
      previewUrl
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    console.log('✅ MediaUpload - Preview preparado (sem upload ainda)');
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-8 w-8" />;
    if (file.type.startsWith('video/')) return <Video className="h-8 w-8" />;
    if (file.type.startsWith('audio/')) return <Music className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  const handleConfirmSend = async () => {
    if (!pendingMedia) return;
    
    setUploading(true);
    
    try {
      // 📤 FAZER UPLOAD AGORA (ao confirmar)
      const fileExt = pendingMedia.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `messages/${fileName}`;

      console.log('📤 MediaUpload - Iniciando upload:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, pendingMedia.file);

      if (uploadError) {
        console.error('❌ MediaUpload - Upload error:', uploadError);
        throw uploadError;
      }

      // ✅ Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      console.log('✅ MediaUpload - Upload concluído:', publicUrl);

      // ✅ Enviar para callback
      onFileSelect(pendingMedia.file, pendingMedia.type, publicUrl, caption || undefined);

      // ✅ Limpar estados
      URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
      setCaption('');

      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('❌ MediaUpload - Erro ao enviar:', error);
      toast.error('Erro ao enviar arquivo', {
        description: 'Tente novamente',
        duration: 4000,
        dismissible: true,
        closeButton: true
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    if (pendingMedia) {
      URL.revokeObjectURL(pendingMedia.previewUrl);
    }
    setPendingMedia(null);
    setCaption('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled}>
            <Paperclip className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Image className="h-4 w-4 mr-2" />
            Imagem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Video className="h-4 w-4 mr-2" />
            Vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Music className="h-4 w-4 mr-2" />
            Áudio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" />
            Documento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/webm,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
            if (file.type.startsWith('image/')) mediaType = 'image';
            else if (file.type.startsWith('video/')) mediaType = 'video';
            else if (file.type.startsWith('audio/')) mediaType = 'audio';
            
            handleFileInputChange(e, mediaType);
          }
        }}
        disabled={uploading}
      />

      {/* Modal de preview */}
      {pendingMedia && (
        <Dialog open={!!pendingMedia} onOpenChange={uploading ? undefined : handleCancelPreview}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Enviar {pendingMedia.type === 'image' ? 'Imagem' : 
                        pendingMedia.type === 'video' ? 'Vídeo' : 
                        pendingMedia.type === 'audio' ? 'Áudio' : 'Documento'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Preview da mídia */}
              {pendingMedia.type === 'image' && (
                <img 
                  src={pendingMedia.previewUrl} 
                  alt="Preview" 
                  className="w-full rounded-lg max-h-[400px] object-contain bg-muted"
                />
              )}
              
              {pendingMedia.type === 'video' && (
                <video 
                  src={pendingMedia.previewUrl} 
                  controls 
                  className="w-full rounded-lg max-h-[400px]"
                />
              )}
              
              {(pendingMedia.type === 'document' || pendingMedia.type === 'audio') && (
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  {pendingMedia.type === 'audio' ? (
                    <Music className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  )}
                  <span className="text-sm flex-1 truncate">{pendingMedia.file.name}</span>
                </div>
              )}
              
              {/* Campo de legenda */}
              <div>
                <Label htmlFor="caption">Legenda (opcional)</Label>
                <Input 
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Digite uma legenda..."
                  className="mt-1"
                />
              </div>
              
              {/* Botões de ação */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={handleCancelPreview}
                  disabled={uploading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmSend}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Indicador de upload */}
      {uploading && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg flex items-center gap-3">
            <Upload className="h-6 w-6 animate-spin" />
            <span>Enviando arquivo...</span>
          </div>
        </div>
      )}
    </>
  );
};