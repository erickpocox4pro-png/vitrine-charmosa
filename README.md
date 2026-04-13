# Vitrine Charmosa

E-commerce de moda feminina desenvolvido com tecnologias modernas.

## Tecnologias

- React 18 + TypeScript
- Vite 5
- Tailwind CSS + shadcn/ui
- Supabase (banco de dados, autenticacao, storage)
- Stripe (pagamentos com cartao)
- PIX (pagamentos instantaneos)

## Como rodar localmente

```sh
# Clonar o repositorio
git clone https://github.com/erickpocox4pro-png/vitrine-charmosa.git

# Entrar na pasta
cd vitrine-charmosa

# Instalar dependencias
npm install

# Criar o arquivo .env com suas variaveis (veja .env.example)
cp .env.example .env

# Rodar o servidor de desenvolvimento
npm run dev
```

## Estrutura do projeto

```
src/
  components/   # Componentes reutilizaveis
  pages/        # Paginas da aplicacao
  contexts/     # Contextos React (auth, carrinho)
  hooks/        # Hooks customizados
  lib/          # Utilitarios
  integrations/ # Configuracao do Supabase
supabase/
  functions/    # Edge Functions (checkout, PIX)
  migrations/   # Migracoes do banco de dados
```

## Deploy

O deploy e feito automaticamente via GitHub Actions. A cada push na branch `main`, o projeto e compilado e publicado na branch `deploy`.
