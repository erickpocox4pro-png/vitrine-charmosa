import { motion } from "framer-motion";
import { ShoppingBag, Sparkles } from "lucide-react";
import logo from "@/assets/logo-vitrine-charmosa.png";

const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full space-y-8"
      >
        <motion.img
          src={logo}
          alt="Vitrine Charmosa"
          className="h-20 mx-auto"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        />

        <div className="relative">
          <motion.div
            className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <ShoppingBag size={36} className="text-primary" />
          </motion.div>
          <motion.div
            className="absolute -top-1 -right-1 left-1/2 ml-6"
            animate={{ rotate: [0, 15, -15, 0], y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Sparkles size={20} className="text-primary/60" />
          </motion.div>
        </div>

        <div className="space-y-3">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Estamos nos preparando para você!
          </h1>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
            Nossa loja está sendo atualizada com novas peças incríveis. 
            Fique de olho — em breve você poderá conferir todas as novidades!
          </p>
        </div>

        <motion.div
          className="flex items-center justify-center gap-1.5 pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-primary/40"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.2 }}
            />
          ))}
        </motion.div>

        <p className="font-body text-xs text-muted-foreground/60 pt-2">
          Vitrine Charmosa • Voltamos em breve ✨
        </p>
      </motion.div>
    </div>
  );
};

export default MaintenancePage;
