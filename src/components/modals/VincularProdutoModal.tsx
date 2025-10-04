import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


interface Product {
  id: string;
  name: string;
  value: number;
}

interface VincularProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string | null;
  currentValue: number;
  onProductLinked?: () => void;
}

export function VincularProdutoModal({ 
  isOpen, 
  onClose, 
  cardId,
  currentValue,
  onProductLinked 
}: VincularProdutoModalProps) {
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (isOpen && selectedWorkspace) {
      loadProducts();
    }
  }, [isOpen, selectedWorkspace]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const loadProducts = async () => {
    if (!selectedWorkspace) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, value')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId || !selectedProductId) return;

    setLoading(true);

    try {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) throw new Error("Produto não encontrado");

      const finalValue = customValue 
        ? parseFloat(customValue.replace(/\D/g, '')) / 100 
        : selectedProduct.value;

      const { error } = await supabase
        .from('pipeline_cards')
        .update({ 
          value: finalValue
        })
        .eq('id', cardId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto vinculado com sucesso"
      });

      onProductLinked?.();
      onClose();
      setSelectedProductId("");
      setCustomValue("");
    } catch (error) {
      console.error('Erro ao vincular produto:', error);
      toast({
        title: "Erro",
        description: "Erro ao vincular produto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-3">
            <Label>Selecione um produto</Label>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto cadastrado. Cadastre produtos em CRM → Produtos.
              </p>
            ) : (
              <RadioGroup value={selectedProductId} onValueChange={setSelectedProductId}>
                {products.map((product) => (
                  <div key={product.id} className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value={product.id} id={product.id} />
                    <Label htmlFor={product.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(product.value)}
                        </span>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          {selectedProduct && (
            <div className="space-y-2 p-4 bg-accent/30 rounded-lg">
              <Label htmlFor="customValue">
                Valor personalizado (opcional)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Valor padrão: {formatCurrency(selectedProduct.value)}
              </p>
              <Input
                id="customValue"
                value={customValue}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  const formatted = (parseFloat(value) / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  });
                  setCustomValue(formatted);
                }}
                placeholder="R$ 0,00"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !selectedProductId}>
              {loading ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
