# --- STAGE 1: BUILD ---
FROM node:20-slim AS builder
WORKDIR /usr/src/app
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build # 👈 Seu código compilado está agora em /usr/src/app/dist

# --- STAGE 2: PRODUCTION (Runtime) ---
FROM node:20-slim
WORKDIR /usr/src/app

# Instala apenas dependências de produção
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod # 👈 Instala apenas dependências necessárias para produção

# Copia o código COMPILADO do estágio 'builder'
COPY --from=builder /usr/src/app/dist ./dist 

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Iniciar a aplicação (Usando o node para o JS compilado)
CMD ["node", "dist/server.js"] # 👈 Altere para o seu arquivo JS compilado