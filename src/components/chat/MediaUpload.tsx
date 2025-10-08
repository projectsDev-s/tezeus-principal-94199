import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Paperclip, Image, FileText, Music, Video, Upload, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaUploadProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document', fileUrl: string) => void;
  disabled?: boolean;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onFileSelect, disabled }) => {
  const [uploading, setUploading] = useState(false);
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

      // Chamar onFileSelect
      console.log('🔔 MediaUpload - Chamando onFileSelect com:', { 
        mediaType, 
        publicUrl, 
        fileName: file.name 
      });
      
      onFileSelect(file, mediaType, publicUrl);
      toast.success('Arquivo enviado com sucesso!');
      
      console.log('✅ MediaUpload - onFileSelect executado com sucesso');
      
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