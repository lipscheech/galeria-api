# Dockerfile para a aplicação Galeria API
# Imagem base Node LTS
FROM node:20-slim

# Diretório de trabalho
WORKDIR /app

# Ativar corepack e instalar pnpm na versão usada pelo projeto
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copiar manifests e instalar dependências
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3333

# Porta exposta
EXPOSE 3333

# Iniciar a aplicação usando tsx (executa TypeScript diretamente). Em produção
# você pode preferir compilar para JS e rodar `node dist/server.js`.
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
