import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Account = () => {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground font-body">Carregando...</p></div>;
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    toast.success("Você saiu da conta.");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-lg mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={16} /> Voltar à loja
        </Link>

        <div className="bg-card rounded-xl p-8 shadow-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-foreground">{user.name}</h1>
              <p className="font-body text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex justify-between items-center py-3">
              <span className="font-body text-sm text-muted-foreground">Nome</span>
              <span className="font-body text-sm font-medium text-foreground">{user.name}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="font-body text-sm text-muted-foreground">E-mail</span>
              <span className="font-body text-sm font-medium text-foreground">{user.email}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-8 w-full py-3 rounded-lg border border-destructive text-destructive font-body font-medium text-sm hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default Account;
