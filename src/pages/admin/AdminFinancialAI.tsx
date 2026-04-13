import { useState, useRef, useEffect } from "react";
import { Brain, RefreshCw, Sparkles, TrendingUp, Wallet, Target, Calendar, Tag, ShoppingCart, BarChart3, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const sectionIcons: Record<string, any> = {
  "Caixa Bruto": Wallet,
  "Reserva": Wallet,
  "Tráfego": TrendingUp,
  "Reinvestimento": ShoppingCart,
  "Pagamentos": CreditCard,
  "Tendências": BarChart3,
  "Pontos a Melhorar": AlertTriangle,
  "Cupons": Tag,
  "Ticket Médio": Target,
  "Descontos": Calendar,
};

const AdminFinancialAI = () => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const generateAnalysis = async () => {
    setLoading(true);
    setContent("");
    setHasGenerated(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-financial-recommendations`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              setContent(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      toast.success("Análise financeira gerada com sucesso!");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar análise");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  const renderMarkdown = (text: string) => {
    // Simple markdown renderer
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-1.5 ml-4 mb-4">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                <span className="text-primary mt-1.5 shrink-0">•</span>
                <span dangerouslySetInnerHTML={{ __html: boldify(item) }} />
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    const boldify = (s: string) =>
      s.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');

    lines.forEach((line, i) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("## ")) {
        flushList();
        const title = trimmed.replace("## ", "");
        const IconComp = Object.entries(sectionIcons).find(([k]) => title.includes(k))?.[1] || Sparkles;
        elements.push(
          <div key={`h2-${i}`} className="flex items-center gap-3 mt-8 mb-3 first:mt-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <IconComp size={18} className="text-primary" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground">{title.replace(/^[^\w\s]+\s*/, "")}</h2>
          </div>
        );
        return;
      }

      if (trimmed.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={`h3-${i}`} className="text-base font-semibold text-foreground mt-4 mb-2">
            {trimmed.replace("### ", "")}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        inList = true;
        listItems.push(trimmed.slice(2));
        return;
      }

      if (trimmed.match(/^\d+\.\s/)) {
        inList = true;
        listItems.push(trimmed.replace(/^\d+\.\s/, ""));
        return;
      }

      flushList();

      if (trimmed === "") {
        return;
      }

      elements.push(
        <p
          key={`p-${i}`}
          className="text-sm text-muted-foreground leading-relaxed mb-3"
          dangerouslySetInnerHTML={{ __html: boldify(trimmed) }}
        />
      );
    });

    flushList();
    return elements;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Brain size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Consultor Financeiro IA</h1>
            <p className="text-sm text-muted-foreground">Análises e recomendações inteligentes para sua loja</p>
          </div>
        </div>
        <Button
          onClick={generateAnalysis}
          disabled={loading}
          className="gap-2"
          size="lg"
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Analisando dados...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              {hasGenerated ? "Gerar Nova Análise" : "Gerar Análise Financeira"}
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      {!hasGenerated && !loading && (
        <div className="border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Brain size={36} className="text-primary/60" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-1">
              Seu consultor financeiro pessoal
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              A IA vai analisar seus relatórios de vendas, pagamentos, cupons e produtos para gerar
              recomendações personalizadas sobre investimento, reserva de caixa, tráfego pago e muito mais.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {["Caixa Bruto", "Tráfego Pago", "Ticket Médio", "Cupons", "Tendências", "Datas Especiais"].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-secondary text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {(loading || content) && (
        <div
          ref={contentRef}
          className="bg-card border border-border rounded-2xl p-6 md:p-8 max-h-[70vh] overflow-y-auto"
        >
          {loading && !content && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw size={18} className="animate-spin text-primary" />
              <span className="text-sm">Analisando dados financeiros da loja...</span>
            </div>
          )}
          <div className="prose-sm max-w-none">{renderMarkdown(content)}</div>
          {loading && content && (
            <div className="flex items-center gap-2 mt-4 text-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-300" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminFinancialAI;
