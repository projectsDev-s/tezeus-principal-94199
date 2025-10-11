import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Paperclip, Image, FileText, Music, Video, Upload, X, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'audio' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📤 MediaUpload - Iniciando upload:', { 
      mediaType, 
      fileName: file.name, 
      fileSize: file.size,
      fileType: file.type 
    });

    setUploading(true);
    try {
      // Upload diretamente para o bucket whatsapp-media/messages/
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `messages/${fileName}`;

      console.log('📦 MediaUpload - Uploading to bucket:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file);

      if (uploadError) {
        console.error('❌ MediaUpload - Upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      console.log('✅ MediaUpload - Upload concluído:', publicUrl);

      // Criar preview URL local
      const previewUrl = URL.createObjectURL(file);

      // Abrir modal de preview ao invés de enviar diretamente
      setPendingMedia({
        file,
        type: mediaType,
        url: publicUrl,
        previewUrl
      });
      
      console.log('✅ MediaUpload - Preview preparado');
      
    } catch (error) {
      console.error('❌ MediaUpload - Erro geral:', error);
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-8 w-8" />;
    if (file.type.startsWith('video/')) return <Video className="h-8 w-8" />;
    if (file.type.startsWith('audio/')) return <Music className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  const handleConfirmSend = () => {
    console.log('🔵 INICIO handleConfirmSend', { pendingMedia: !!pendingMedia, caption });
    if (!pendingMedia) return;
    
    // ✅ Capturar o caption ANTES de qualquer limpeza
    const finalCaption = caption.trim() || undefined;
    
    console.log('🎯 MediaUpload - Caption CAPTURADO:', { 
      captionOriginal: caption, 
      captionTrim: caption.trim(),
      finalCaption,
      file: pendingMedia.file.name 
    });
    
    // Limpar preview e estado
    URL.revokeObjectURL(pendingMedia.previewUrl);
    const mediaToSend = { ...pendingMedia }; // Clone para evitar referência
    setPendingMedia(null);
    setCaption('');
    
    console.log('🟢 ANTES de chamar onFileSelect:', { finalCaption });
    
    // Chamar callback DEPOIS da limpeza visual
    onFileSelect(mediaToSend.file, mediaToSend.type, mediaToSend.url, finalCaption);
    
    console.log('✅ onFileSelect CHAMADO com caption:', finalCaption);
    
    toast.success('Arquivo enviado com sucesso!');
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
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
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
        <Dialog open={!!pendingMedia} onOpenChange={handleCancelPreview}>
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
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleConfirmSend}>
                  <Check className="h-4 w-4 mr-2" />
                  Enviar
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