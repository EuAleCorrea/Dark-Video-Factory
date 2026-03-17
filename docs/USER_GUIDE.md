# Guia de Uso — Dark Video Factory V1.0

Bem-vindo ao novo editor visual! Este guia explica como criar um vídeo do zero usando a inteligência artificial do sistema.

---

## 1. Criando seu Primeiro Projeto

1.  No topo da tela, clique no botão **"+"** de abas (ao lado das abas de projetos abertos).
2.  Dê um nome ao seu projeto e selecione o perfil de canal (Ex: Curiosidades Dark, Shorts, etc.).
3.  O projeto será criado e aparecerá no editor.

---

## 2. O Workflow de Criação (Passo a Passo)

Abra a aba **"Workflow"** no painel superior esquerdo e siga as 6 etapas:

### Step 1: Referência 🔍
- Digite o nome de um canal do YouTube ou uma URL.
- Clique em **"Transcrever"**. A IA usará o APIFY para buscar o texto original do vídeo.
- Verifique se o texto apareceu no campo de transcrição.

### Step 2: Roteiro ✍️
- Selecione o modelo de IA (ex: Gemini 2.0 Flash).
- Clique em **"Reescrever com IA"**.
- O sistema executará o "Prompt de Reescrita" e o "Prompt de Estruturação" em sequência. O resultado será um roteiro viral pronto para narração.

### Step 3: Áudio 🎙️
- Escolha o provedor (Google Gemini ou ElevenLabs).
- Clique em **"Gerar Narração"**. 
- O áudio será gerado e inserido automaticamente na **Track de Áudio** da timeline.

### Step 4: Legendas 📝
- Clique em **"Gerar Legendas"**.
- O sistema dividirá seu roteiro em blocos de 9 a 18 segundos, alinhados com o tempo real do seu áudio.
- Os blocos aparecerão na **Track de Texto** da timeline.

### Step 5: Imagens 🖼️
- Selecione o modelo de imagem (ex: Flux.1 via RunWare).
- Clique em **"Gerar Imagens em Lote"**.
- A IA criará uma imagem única para cada cena do seu storyboard e as inserirá na **Track de Vídeo** da timeline, cobrindo todo o vídeo.

### Step 6: Exportação 🎬
- Escolha o formato (Vertical para Shorts/TikTok ou Horizontal para YouTube Longo).
- Clique em **"Renderizar Vídeo"**.
- O FFmpeg começará a processar e, ao final, o vídeo estará pronto na sua pasta de Downloads.

---

## 3. Dicas de Edição na Timeline

-   **Movimentação**: Arraste clips horizontalmente para mudar o tempo.
-   **Ajuste**: Arraste as bordas laterais de um clip para dar "trim" (encurtar ou esticar).
-   **Corte**: Posicione o playhead (linha vermelha) e use o botão de **"Corta"** (tesoura) para dividir um clip.
-   **Remoção**: Clique com o botão direito em um clip e selecione **"Excluir"**.
-   **Undo/Redo**: Use `CTRL+Z` para desfazer qualquer erro.

---

## 4. Ferramentas Extras

-   **Mídia**: Arraste imagens da galeria ou busque no Pexels diretamente para a timeline.
-   **Áudio**: Use as sub-tabs de áudio para gerar narrações avulsas ou sons de fundo.
-   **Configurações ⚙**: Acesse o ícone de engrenagem no topo para atualizar suas chaves de API e caminhos de diretório.
