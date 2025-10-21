import { useState, useEffect } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { supabase } from "@/integrations/supabase/client";

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: {
    workspace_id: string;
    name: string;
    cnpj?: string;
    connectionLimit?: number;
    userLimit?: number;
  };
}

export function CreateWorkspaceModal({ open, onOpenChange, workspace }: CreateWorkspaceModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    connectionLimit: 0,
    userLimit: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createWorkspace, updateWorkspace } = useWorkspaces();
  
  const isEditing = !!workspace;

  // Fetch limits directly from database when modal opens in edit mode
  React.useEffect(() => {
    const fetchLimitsDirectly = async () => {
      if (!workspace?.workspace_id || !open) {
        console.log('⏭️ Skipping direct fetch - no workspace or modal closed');
        return;
      }

      console.log('🔍 Fetching limits directly for workspace:', workspace.workspace_id);
      
      try {
        const { data: limitData, error } = await supabase
          .from('workspace_limits')
          .select('connection_limit, user_limit')
          .eq('workspace_id', workspace.workspace_id)
          .maybeSingle();
        
        console.log('📊 Direct fetch result:', limitData);
        
        if (error) {
          console.error('❌ Error fetching limits:', error);
          return;
        }

        if (limitData) {
          const newFormData = {
            name: workspace.name || "",
            cnpj: workspace.cnpj || "",
            connectionLimit: limitData.connection_limit ?? 0,
            userLimit: limitData.user_limit ?? 0,
          };
          
          console.log('✅ Setting form data from direct fetch:', newFormData);
          setFormData(newFormData);
        }
      } catch (error) {
        console.error('❌ Exception fetching limits:', error);
      }
    };

    if (workspace && open) {
      fetchLimitsDirectly();
    } else if (!workspace && open) {
      console.log('🆕 New workspace - resetting form');
      setFormData({ name: "", cnpj: "", connectionLimit: 0, userLimit: 0 });
    }
  }, [workspace?.workspace_id, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isEditing && workspace) {
        console.log('🚀 Submitting update with data:', {
          workspaceId: workspace.workspace_id,
          name: formData.name.trim(),
          cnpj: formData.cnpj.trim() || undefined,
          connectionLimit: formData.connectionLimit,
          userLimit: formData.userLimit,
        });
        
        await updateWorkspace(workspace.workspace_id, {
          name: formData.name.trim(),
          cnpj: formData.cnpj.trim() || undefined,
          connectionLimit: formData.connectionLimit,
          userLimit: formData.userLimit,
        });
      } else {
        await createWorkspace(formData.name.trim(), formData.cnpj.trim() || undefined, formData.connectionLimit, formData.userLimit);
      }
      
      // Reset form
      setFormData({ name: "", cnpj: "", connectionLimit: 0, userLimit: 0 });
      onOpenChange(false);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: "", cnpj: "", connectionLimit: 0, userLimit: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Digite o nome da empresa"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="connectionLimit">Limite de Conexões *</Label>
            <Input
              id="connectionLimit"
              type="number"
              value={formData.connectionLimit}
              onChange={(e) => {
                const newValue = parseInt(e.target.value) || 0;
                console.log('🔢 connectionLimit input changed to:', newValue);
                setFormData(prev => ({ ...prev, connectionLimit: newValue }));
              }}
              placeholder="0"
              required
            />
            <p className="text-xs text-muted-foreground">
              Número máximo de conexões WhatsApp permitidas para esta empresa
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userLimit">Limite de Usuários *</Label>
            <Input
              id="userLimit"
              type="number"
              value={formData.userLimit}
              onChange={(e) => {
                const newValue = parseInt(e.target.value) || 0;
                console.log('🔢 userLimit input changed to:', newValue);
                setFormData(prev => ({ ...prev, userLimit: newValue }));
              }}
              placeholder="0"
              required
            />
            <p className="text-xs text-muted-foreground">
              Número máximo de usuários que podem ser criados para esta empresa
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting 
                ? (isEditing ? "Salvando..." : "Criando...") 
                : (isEditing ? "Salvar" : "Criar Empresa")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}