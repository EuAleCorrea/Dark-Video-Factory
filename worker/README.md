# Dark Factory - Local Rendering Worker

Este é o Worker de Renderização Local que roda na sua máquina via Docker.

## O que ele faz?

1. **Escuta** o Supabase por jobs com status `RENDERING_PENDING`
2. **Baixa** os assets (imagens e áudio) do Supabase Storage
3. **Executa** o FFmpeg para montar o vídeo final
4. **Faz upload** do vídeo renderizado de volta para o Storage
5. **Atualiza** o status do job para `THUMBNAIL_GEN`

## Pré-requisitos

- Docker Desktop instalado e rodando
- Acesso ao Supabase (Service Role Key)

## Configuração

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```

2. Edite o `.env` com suas credenciais:
   ```
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_KEY=sua-service-role-key
   ```

   > ⚠️ **Importante**: Use a `service_role` key, não a `anon` key!
   > Você encontra ela em: Supabase > Settings > API > Service Role Key

## Executando

### Modo Docker (Recomendado)

```bash
# Construir a imagem
npm run docker:build

# Iniciar o container
npm run docker:run

# Ver logs
docker logs -f dark-factory-worker
```

### Modo Desenvolvimento (Sem Docker)

```bash
# Instalar dependências
npm install

# Rodar em modo dev
npm run dev
```

## Auto-Start com Windows

Para que o worker inicie automaticamente:

1. Certifique-se que o Docker Desktop está configurado para iniciar com o Windows
2. Defina `restart: unless-stopped` no docker-compose.yml (já está configurado)

O container será reiniciado automaticamente sempre que o Docker iniciar!

## Estrutura

```
worker/
├── src/
│   ├── index.ts           # Ponto de entrada
│   └── processors/
│       └── ffmpeg.ts      # Lógica de renderização
├── Dockerfile             # Imagem Docker
├── docker-compose.yml     # Orquestração
└── package.json           # Dependências
```

## Logs

Os logs do container são gravados em formato JSON e limitados a 10MB para não encher o disco.

Para ver os logs em tempo real:
```bash
docker logs -f dark-factory-worker
```
