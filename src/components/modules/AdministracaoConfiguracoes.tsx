import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppProvidersMaster } from "./master/WhatsAppProvidersMaster";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ColorPickerModal } from "@/components/modals/ColorPickerModal";
import { useSystemCustomization } from "@/hooks/useSystemCustomization";
import { useAuth } from "@/hooks/useAuth";
import { Upload, RotateCcw, Palette } from "lucide-react";

export function AdministracaoConfiguracoes() {
  const [loading, setLoading] = useState(false);
  const { hasRole } = useAuth();
  const { 
    customization, 
    loading: customizationLoading, 
    updateCustomization, 
    resetToDefaults 
  } = useSystemCustomization();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [activeColorField, setActiveColorField] = useState<'primary' | 'background' | 'header' | 'sidebar' | null>(null);

  // Handle logo file selection
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle favicon file selection
  const handleFaviconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle customization updates
  const handleCustomizationUpdate = async (field: string, value: string) => {
    try {
      await updateCustomization({ [field]: value });
      toast({
        title: 'Personalização atualizada',
        description: 'As mudanças foram aplicadas com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleColorSelect = (color: string) => {
    if (activeColorField) {
      handleCustomizationUpdate(`${activeColorField}_color`, color);
    }
    setColorPickerOpen(false);
    setActiveColorField(null);
  };

  const openColorPicker = (field: 'primary' | 'background' | 'header' | 'sidebar') => {
    setActiveColorField(field);
    setColorPickerOpen(true);
  };

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile) return;

    try {
      setLoading(true);
      
      // Upload to Supabase storage
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `system-logo-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(fileName, logoFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(fileName);

      // Update customization with new logo URL
      await updateCustomization({ logo_url: urlData.publicUrl });
      
      setLogoFile(null);
      setLogoPreview(null);
      
      toast({
        title: 'Logo atualizada',
        description: 'A nova logo foi aplicada com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle favicon upload
  const handleFaviconUpload = async () => {
    if (!faviconFile) return;

    try {
      setLoading(true);
      
      // Upload to Supabase storage
      const fileExt = faviconFile.name.split('.').pop();
      const fileName = `system-favicon-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(fileName, faviconFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(fileName);

      // Update customization with new favicon URL
      await updateCustomization({ favicon_url: urlData.publicUrl });
      
      // Update the favicon in the document
      updateFaviconInDocument(urlData.publicUrl);
      
      setFaviconFile(null);
      setFaviconPreview(null);
      
      toast({
        title: 'Favicon atualizado',
        description: 'O novo favicon foi aplicado com sucesso. Recarregue a página para ver as mudanças.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Update favicon in document head
  const updateFaviconInDocument = (url: string) => {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());
    
    // Add new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  };

  // Handle reset to defaults
  const handleResetDefaults = async () => {
    try {
      await resetToDefaults();
      toast({
        title: 'Configurações restauradas',
        description: 'O sistema foi restaurado para as configurações padrão'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao restaurar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-6">
      
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <Tabs defaultValue="personalizacao" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-t-lg rounded-b-none h-auto p-0">
            <TabsTrigger 
              value="personalizacao" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              Personalização
            </TabsTrigger>
            <TabsTrigger 
              value="api-whatsapp" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              API WhatsApp
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="personalizacao" className="p-6 mt-0">
            {hasRole(['master']) ? (
              <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <Palette className="w-6 h-6 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Personalização do Sistema</h2>
                    <p className="text-sm text-muted-foreground">Configure a aparência global do sistema</p>
                  </div>
                </div>

                {/* Logo Section */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-foreground">Logo do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-foreground">
                        Upload de Logo
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          disabled={loading || customizationLoading}
                          className="flex-1"
                        />
                        {logoFile && (
                          <Button 
                            onClick={handleLogoUpload} 
                            disabled={loading || customizationLoading}
                            size="sm"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-foreground">
                        Preview
                      </Label>
                      <div className="w-32 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                        ) : customization.logo_url ? (
                          <img src={customization.logo_url} alt="Current logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Nenhuma logo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Favicon Section */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-foreground">Favicon do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-foreground">
                        Upload de Favicon
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Formatos recomendados: .ico, .png (32x32 ou 16x16 pixels)
                      </p>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept="image/x-icon,image/png,image/svg+xml"
                          onChange={handleFaviconChange}
                          disabled={loading || customizationLoading}
                          className="flex-1"
                        />
                        {faviconFile && (
                          <Button 
                            onClick={handleFaviconUpload} 
                            disabled={loading || customizationLoading}
                            size="sm"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-foreground">
                        Preview
                      </Label>
                      <div className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                        {faviconPreview ? (
                          <img src={faviconPreview} alt="Favicon preview" className="w-8 h-8 object-contain" />
                        ) : customization.favicon_url ? (
                          <img src={customization.favicon_url} alt="Current favicon" className="w-8 h-8 object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Nenhum favicon</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colors Section */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-foreground">Cores do Sistema</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cor Primária</Label>
                      <Button
                        variant="outline"
                        className="w-full h-20 p-2 flex flex-col items-center gap-2"
                        onClick={() => openColorPicker('primary')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.primary_color }}
                      >
                        <div className="text-xs font-mono text-black">
                          {customization.primary_color}
                        </div>
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Cor de Fundo</Label>
                      <Button
                        variant="outline"
                        className="w-full h-20 p-2 flex flex-col items-center gap-2"
                        onClick={() => openColorPicker('background')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.background_color }}
                      >
                        <div className="text-xs font-mono text-white">
                          {customization.background_color}
                        </div>
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Cor do Header</Label>
                      <Button
                        variant="outline"
                        className="w-full h-20 p-2 flex flex-col items-center gap-2"
                        onClick={() => openColorPicker('header')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.header_color }}
                      >
                        <div className="text-xs font-mono text-white">
                          {customization.header_color}
                        </div>
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Cor da Sidebar</Label>
                      <Button
                        variant="outline"
                        className="w-full h-20 p-2 flex flex-col items-center gap-2"
                        onClick={() => openColorPicker('sidebar')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.sidebar_color }}
                      >
                        <div className="text-xs font-mono text-white">
                          {customization.sidebar_color}
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button 
                    variant="outline" 
                    onClick={handleResetDefaults}
                    disabled={loading || customizationLoading}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restaurar Padrão
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Palette className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Acesso Restrito</h3>
                <p className="text-muted-foreground">
                  Apenas usuários master podem personalizar o sistema.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="api-whatsapp" className="p-0 mt-0">
            <WhatsAppProvidersMaster />
          </TabsContent>

        </Tabs>
      </div>

      <ColorPickerModal
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        onColorSelect={handleColorSelect}
      />
    </div>
  );
}