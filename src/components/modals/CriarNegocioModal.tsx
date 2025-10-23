import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceUsers } from "@/hooks/useWorkspaceUsers";
import { useProducts } from "@/hooks/useProducts";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";

interface CriarNegocioModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onCreateBusiness?: (business: any) => void;
  isDarkMode?: boolean;
  preSelectedContactId?: string;
  preSelectedContactName?: string;
  onResponsibleUpdated?: () => void;
}

export function CriarNegocioModal({ 
  isOpen, 
  open, 
  onClose, 
  onOpenChange, 
  onCreateBusiness, 
  isDarkMode = false,
  preSelectedContactId,
  preSelectedContactName,
  onResponsibleUpdated
}: CriarNegocioModalProps) {
  const modalOpen = open ?? isOpen ?? false;
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const [selectedLead, setSelectedLead] = useState(preSelectedContactId || "");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [value, setValue] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  
  const { selectedWorkspace } = useWorkspace();
  const { pipelines } = usePipelines();
  const { columns, fetchColumns } = usePipelineColumns(selectedPipeline || null);
  
  // Estabilizar o array de filtros para evitar loop infinito
  const profileFilters = useMemo<('user' | 'admin' | 'master')[]>(() => ['user', 'admin'], []);
  
  const { users, isLoading: isLoadingUsers } = useWorkspaceUsers(
    selectedWorkspace?.workspace_id, 
    profileFilters
  );
  const { products, isLoading: isLoadingProducts } = useProducts();

  // Buscar contatos
  useEffect(() => {
    const fetchContacts = async () => {
      if (!selectedWorkspace) return;
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      
      if (!error && data) {
        setContacts(data);
      }
    };
    
    fetchContacts();
  }, [selectedWorkspace]);


  // Pré-selecionar contato quando fornecido
  useEffect(() => {
    if (preSelectedContactId) {
      setSelectedLead(preSelectedContactId);
    }
  }, [preSelectedContactId]);

  // Preencher valor automaticamente ao selecionar produto
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      if (product) {
        setValue(product.value.toString());
      }
    }
  }, [selectedProduct, products]);

  // Carregar colunas quando pipeline for selecionado
  useEffect(() => {
    if (selectedPipeline) {
      fetchColumns();
    }
  }, [selectedPipeline]);

  // Atualizar primeira coluna quando colunas mudarem
  useEffect(() => {
    if (columns.length > 0 && !selectedColumn) {
      setSelectedColumn(columns[0].id);
    }
  }, [columns]);

  // Validar se pode habilitar botão criar
  const canCreate = selectedLead && selectedResponsible && selectedPipeline && selectedColumn;

  const handleSubmit = async () => {
    if (!canCreate) return;
    
    const newBusiness = {
      lead: selectedLead,
      responsible: selectedResponsible,
      pipeline: selectedPipeline,
      product: selectedProduct || null,
      column: selectedColumn,
      value: value ? parseFloat(value) : 0
    };
    
    if (onCreateBusiness) {
      try {
        await onCreateBusiness(newBusiness);
        
        if (onResponsibleUpdated) {
          onResponsibleUpdated();
        }
        
        // Reset form apenas se sucesso
        setSelectedLead(preSelectedContactId || "");
        setSelectedResponsible("");
        setSelectedPipeline("");
        setSelectedProduct("");
        setSelectedColumn("");
        setValue("");
        
        handleClose();
      } catch (error: any) {
        // Erro já foi tratado no contexto com toast
        console.error('Erro ao criar negócio:', error);
      }
    }
  };

  return (
    <Dialog open={modalOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-md",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white border-gray-200 text-gray-900"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Criar Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Lead */}
          <div>
            <Select value={selectedLead} onValueChange={setSelectedLead} disabled={!!preSelectedContactId}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder={preSelectedContactName || "Selecione o Lead"} />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name} - {contact.phone || contact.email || 'Sem contato'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de responsável */}
          <div>
            <Select value={selectedResponsible} onValueChange={setSelectedResponsible} disabled={isLoadingUsers}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder={
                  isLoadingUsers 
                    ? "Carregando usuários..." 
                    : users.length === 0 
                      ? "Nenhum usuário disponível" 
                      : "Selecione o responsável"
                } />
              </SelectTrigger>
              {users.length > 0 && (
                <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Seleção de pipeline */}
          <div>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de coluna */}
          <div>
            <Select 
              value={selectedColumn} 
              onValueChange={setSelectedColumn}
              disabled={!selectedPipeline || columns.length === 0}
            >
              <SelectTrigger className="border-input">
                <SelectValue placeholder={
                  !selectedPipeline 
                    ? "Selecione um pipeline primeiro" 
                    : columns.length === 0 
                      ? "Nenhuma coluna disponível" 
                      : "Selecione a coluna"
                } />
              </SelectTrigger>
              {columns.length > 0 && (
                <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Seleção de produto (opcional) */}
          <div>
            <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isLoadingProducts}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder={
                  isLoadingProducts 
                    ? "Carregando produtos..." 
                    : products.length === 0 
                      ? "Nenhum produto disponível" 
                      : "Selecione o produto (Opcional)"
                } />
              </SelectTrigger>
              {products.length > 0 && (
                <SelectContent className="max-h-48 overflow-auto bg-popover z-50">
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Campo de valor */}
          <div>
            <Label htmlFor="value" className="text-sm text-muted-foreground">
              Valor (Opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className="pl-8 border-input"
              />
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-red-500 hover:text-red-600"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canCreate}
            className={cn(
              "transition-opacity",
              !canCreate && "opacity-50 cursor-not-allowed"
            )}
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}