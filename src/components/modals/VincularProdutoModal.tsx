import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
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
  currentProductId?: string | null;
  onProductLinked?: () => void;
}

export function VincularProdutoModal({
  isOpen,
  onClose,
  cardId,
  currentValue,
  currentProductId = null,
  onProductLinked,
}: VincularProdutoModalProps) {
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>("manual");
  const [manualValue, setManualValue] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    const initialOption = currentProductId || "manual";
    setSelectedOption(initialOption);
    setManualValue(initialOption === "manual" ? currentValue.toString() : "");
    setIsRemoving(false);

    if (selectedWorkspace) {
      loadProducts();
    }
  }, [isOpen, currentProductId, currentValue, selectedWorkspace]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const loadProducts = async () => {
    if (!selectedWorkspace) return;

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, value")
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .order("name");

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos",
        variant: "destructive",
      });
    }
  };

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);
    if (value === "manual") {
      setManualValue(currentValue.toString());
    } else {
      setManualValue("");
    }
  };

  const isManualMode = selectedOption === "manual";
  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedOption), [products, selectedOption]);
  const submitDisabled =
    loading ||
    isRemoving ||
    (isManualMode ? manualValue.trim().length === 0 : !selectedProduct);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cardId || !selectedWorkspace) return;

    setLoading(true);

    try {
      if (isManualMode) {
        const manual = parseFloat(manualValue.replace(",", "."));
        if (Number.isNaN(manual)) {
          throw new Error("Valor inválido");
        }

        await supabase.from("pipeline_cards_products").delete().eq("pipeline_card_id", cardId);

        const { error } = await supabase
          .from("pipeline_cards")
          .update({ value: manual })
          .eq("id", cardId);

        if (error) throw error;

        toast({
          title: "Valor atualizado",
          description: "Valor manual definido com sucesso.",
        });
      } else if (selectedProduct) {
        await supabase.from("pipeline_cards_products").delete().eq("pipeline_card_id", cardId);

        const { error: insertError } = await supabase.from("pipeline_cards_products").insert({
          pipeline_card_id: cardId,
          product_id: selectedProduct.id,
          workspace_id: selectedWorkspace.workspace_id,
          quantity: 1,
          unit_value: selectedProduct.value,
          total_value: selectedProduct.value,
          is_recurring: false,
        });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from("pipeline_cards")
          .update({ value: selectedProduct.value })
          .eq("id", cardId);

        if (updateError) throw updateError;

        toast({
          title: "Produto vinculado",
          description: "Produto vinculado ao negócio com sucesso.",
        });
      }

      onProductLinked?.();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar alterações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDetachProduct = async () => {
    if (!cardId) return;
    setIsRemoving(true);

    try {
      await supabase.from("pipeline_cards_products").delete().eq("pipeline_card_id", cardId);
      const { error } = await supabase.from("pipeline_cards").update({ value: null }).eq("id", cardId);
      if (error) throw error;

      toast({
        title: "Produto desvinculado",
        description: "O produto foi removido do negócio.",
      });

      onProductLinked?.();
      setSelectedOption("manual");
      setManualValue("");
    } catch (error) {
      console.error("Erro ao desvincular produto:", error);
      toast({
        title: "Erro",
        description: "Erro ao desvincular produto",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Valor atual do negócio</span>
            <span className="font-semibold">{formatCurrency(currentValue || 0)}</span>
          </div>

          <div className="space-y-3">
            <Label>Selecione um produto</Label>
            <RadioGroup value={selectedOption} onValueChange={handleOptionChange}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="manual" id="manual-option" />
                <Label htmlFor="manual-option" className="flex-1 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Sem produto vinculado</span>
                    <span className="text-xs text-muted-foreground">Permite definir valor manual</span>
                  </div>
                </Label>
              </div>
              {products.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Nenhum produto cadastrado. Cadastre produtos em CRM → Produtos.
                </div>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <RadioGroupItem value={product.id} id={`product-${product.id}`} />
                    <Label htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-sm text-muted-foreground">{formatCurrency(product.value)}</span>
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualValue">Valor manual</Label>
            <Input
              id="manualValue"
              type="number"
              step="0.01"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              disabled={!isManualMode}
              placeholder="0,00"
            />
            {!isManualMode && (
              <p className="text-xs text-muted-foreground">
                Valor manual disponível apenas quando nenhum produto está vinculado.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {selectedOption !== "manual" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDetachProduct}
                disabled={isRemoving || loading}
              >
                {isRemoving ? "Desvinculando..." : "Desvincular"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={loading || isRemoving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
