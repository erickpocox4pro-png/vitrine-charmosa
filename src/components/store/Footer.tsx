import { Instagram, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  const links = [
    { label: "Sobre Nós", to: "/sobre-nos" },
    { label: "Política de Troca", to: "/politica-troca" },
    { label: "Guia de Tamanhos", to: "/guia-tamanhos" },
    { label: "Entrega e Frete", to: "/entrega-frete" },
  ];

  return (
    <footer className="bg-background border-t border-border">
      <div className="container px-5 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground mb-2.5">Vitrine Charmosa</h3>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Moda feminina com elegância e sofisticação. Peças cuidadosamente selecionadas para realçar sua beleza natural.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com/vitrinecharmosaa/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary active:scale-95 transition-all" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a href="https://wa.me/5582993879439" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary active:scale-95 transition-all" aria-label="WhatsApp">
                <MessageCircle size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-body text-sm font-semibold text-foreground mb-3">Links Rápidos</h4>
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="font-body text-sm text-muted-foreground hover:text-primary active:text-primary transition-colors flex items-center gap-2 py-1.5">
                    <span className="text-muted-foreground/40">▸</span> {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-body text-sm font-semibold text-foreground mb-3">Contato</h4>
            <ul className="space-y-2">
              <li className="font-body text-sm text-muted-foreground">WhatsApp: +55 (82) 99387-9439</li>
              <li className="font-body text-sm text-muted-foreground">Email: contato@vitrinecharmosa.com.br</li>
              <li className="font-body text-sm text-muted-foreground">Atendimento: Seg-Sab 10h às 21h</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-5 text-center">
          <p className="font-body text-xs text-muted-foreground">
            © 2026 Vitrine Charmosa. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
