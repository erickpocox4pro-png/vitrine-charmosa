import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type GeneratedSale = {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  payment_method?: string;
  sale_date: string;
  notes?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalesCreated: () => void;
}

const EXAMPLES = [
  '5 vendas de 45 reais no dia 15/01/2026',
  '3 vendas de Camiseta por 89,90 em pix nos dias 10, 11 e 12/03/2026',
  '10 vendas de 120 reais distribuídas entre 01/02 e 10/02/2026',
];

const AiBulkSalesModal = ({ open, onOpenChange, onSalesCreated }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState<GeneratedSale[]>([]);
  const [step, setStep] = useState<"prompt" | "review">("prompt");

  const reset = () => {
    setPrompt("");
    setSales([]);
    setStep("prompt");
    setGenerating(false);
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-manual-sales", {
        body: { prompt: prompt.trim() },
      });
      if (error) throw new Error(error.message || "Erro ao gerar vendas");
      if (data?.error) throw new Error(data.error);
      if (!data?.sales?.length) throw new Error("IA não gerou nenhuma venda");

      setSales(data.sales);
      setStep("review");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar vendas com IA");
    } finally {
      setGenerating(false);
    }
  };

  const removeSale = (idx: number) => {
    setSales((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSale = (idx: number, field: keyof GeneratedSale, value: any) => {
    setSales((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const updated = { ...s, [field]: value };
        if (field === "unit_price" || field === "quantity") {
          updated.total = (updated.unit_price || 0) * (updated.quantity || 1);
        }
        return updated;
      })
    );
  };

  const handleSaveAll = async () => {
    if (!sales.length) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const rows = sales.map((s) => ({
        product_name: s.product_name || "Produto não especificado",
        quantity: s.quantity || 1,
        unit_price: s.unit_price,
        total: s.total || s.unit_price * (s.quantity || 1),
        payment_method: s.payment_method || "dinheiro",
        sale_date: s.sale_date,
        notes: s.notes || null,
        admin_user_id: session.user.id,
        admin_email: session.user.email || "",
        product_id: null,
        variant_id: null,
        variant_name: null,
      }));

      const { error } = await supabase.from("manual_sales").insert(rows);
      if (error) throw error;

      toast.success(`${rows.length} vendas criadas com sucesso!`);
      onSalesCreated();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar vendas");
    } finally {
      setSaving(false);
    }
  };

  const totalGeral = sales.reduce((s, v) => s + (v.total || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Gerar Vendas com IA
          </DialogTitle>
          <DialogDescription>
            Descreva as vendas em linguagem natural e a IA criará os registros automaticamente
          </DialogDescription>
        </DialogHeader>

        {step === "prompt" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Descreva as vendas</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: 5 vendas de 45 reais no dia 31/01/2026 em pix..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground font-medium">Exemplos:</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(ex)}
                    className="text-[11px] px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-left"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Gerando vendas...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Gerar Vendas
                </>
              )}
            </Button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {sales.length} venda{sales.length !== 1 ? "s" : ""} gerada{sales.length !== 1 ? "s" : ""}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setStep("prompt")}>
                ← Voltar ao prompt
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs w-16">Qtd</TableHead>
                    <TableHead className="text-xs w-24">Valor</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          value={sale.product_name}
                          onChange={(e) => updateSale(idx, "product_name", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={sale.quantity}
                          onChange={(e) => updateSale(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="h-7 text-xs w-14"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={sale.unit_price}
                          onChange={(e) => updateSale(idx, "unit_price", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs w-20"
                        />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {(() => {
                          try {
                            return format(new Date(sale.sale_date), "dd/MM/yy");
                          } catch {
                            return sale.sale_date;
                          }
                        })()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeSale(idx)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Total geral</p>
                <p className="text-lg font-semibold font-mono text-primary">
                  R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Você pode editar os produtos depois
              </p>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleSaveAll}
              disabled={saving || !sales.length}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Salvando {sales.length} vendas...
                </>
              ) : (
                <>Confirmar e Criar {sales.length} Venda{sales.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AiBulkSalesModal;
