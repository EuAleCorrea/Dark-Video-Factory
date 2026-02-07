# ================================
# Dark Factory - Local Worker
# ================================
FROM node:20-alpine

# Instalar FFmpeg
RUN apk add --no-cache ffmpeg

# Diretório de trabalho
WORKDIR /app

# Copiar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte compilado
COPY dist/ ./dist/

# Criar diretórios de trabalho
RUN mkdir -p /tmp/dark-factory /output

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV TEMP_DIR=/tmp/dark-factory
ENV OUTPUT_DIR=/output
ENV FFMPEG_PATH=/usr/bin/ffmpeg

# Executar o worker
CMD ["node", "dist/index.js"]
