# ApplyAI — Vagas Kanban

Aplicação local para acompanhar candidaturas a vagas de tecnologia. Ela busca vagas em APIs públicas, organiza o pipeline num kanban e gera um currículo adaptado a cada vaga com um modelo escolhido no [OpenRouter](https://openrouter.ai/).

Os dados ficam num banco SQLite na sua máquina. A chave de IA é gravada nesse banco, criptografada, e não entra no código nem no `.env`.

## O que a aplicação faz

- Lê um currículo em Markdown e um arquivo de critérios de busca.
- Consulta providers de vagas (Remote OK, Remotive, Arbeitnow, Jobicy e, se configurados, Adzuna e LinkedIn).
- Calcula um score local de compatibilidade e coloca no kanban as vagas acima de 70%.
- Permite importar um JSON produzido fora da aplicação, no formato da skill `job-search-and-match`.
- Gera um currículo em Markdown por vaga, com cópia, download `.md` e PDF.
- Registra o custo estimado das chamadas de IA.
- Guarda comentários, histórico de importação e o tempo em cada etapa do kanban.

O score geral usa pesos fixos: tecnologias 40%, experiência 30%, salário 20% e localização 10%. Essa conta não chama IA.

## Pré-requisitos

- Node.js 20 ou superior. O arquivo `.nvmrc` indica a versão usada no desenvolvimento. [nvm](https://github.com/nvm-sh/nvm) ajuda a instalar a mesma versão.
- Uma conta e uma chave no [OpenRouter](https://openrouter.ai/keys) para gerar currículos e refinar a busca. A busca de vagas e o kanban funcionam sem essa chave.

## Instalação

Na raiz do repositório:

```bash
nvm install
nvm use

cp .env.example .env
cp resume.example.md resume.md
cp search-query.example.txt search-query.txt

npm install
npm install --prefix server
npm install --prefix client
```

O `postinstall` do server recompila o `better-sqlite3` para o Node em uso. Use a mesma versão do Node em todos os terminais.

Suba a API e o frontend juntos:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health

A resposta esperada do health check é `{"ok":true}`.

Outros comandos:

```bash
npm run dev:server   # só a API
npm run dev:client   # só o Vite
npm run build        # build de produção do client
npm test             # testes da API e build do client
```

## Configuração

### 1. Currículo e critérios de busca

`resume.md` e `search-query.txt` ficam só na sua máquina. O repositório traz `resume.example.md` e `search-query.example.txt` para copiar e editar.

Na página **Configurações** dá para informar outro caminho, absoluto ou relativo à raiz do projeto, ou escolher o arquivo pelo diálogo do sistema. O caminho escolhido é salvo no SQLite.

### 2. Modelo e credencial de IA

Abra **Configurações** e use a seção **Inteligência artificial**.

1. Crie uma chave em https://openrouter.ai/keys.
2. Cole a chave no campo da aplicação. Ela não volta para a tela depois de salva; a interface mostra só os quatro últimos caracteres.
3. Escolha o modelo no menu. Ele mostra 10 opções por vez, com o preço de entrada e o de saída de cada uma, e uma busca interna. A pesquisa substitui essa lista pelos 10 resultados correspondentes. Depois da escolha, a tela mostra o nome, o identificador, o tamanho de contexto e os dois preços. O catálogo vem de `GET https://openrouter.ai/api/v1/models`. Se essa consulta falhar, a tela usa uma lista local com modelos de OpenAI, Anthropic, Google, DeepSeek, Meta, Mistral e Qwen.
4. Clique em **Testar conexão**. A aplicação faz uma chamada curta ao modelo escolhido e mostra se a chave foi aceita. A chave digitada só é gravada em **Salvar IA**. Se o campo estiver vazio e já existir uma chave salva, o teste usa essa chave.
5. Clique em **Salvar IA**.

O OpenRouter é a porta de entrada: a mesma chave chama modelos de vários provedores. A geração de currículo e o refinamento da busca usam o modelo selecionado.

A chave é criptografada com AES-256-GCM antes de ir para a tabela `settings`. A chave de criptografia é criada na primeira gravação, ao lado do banco, num arquivo `data/.vagas.db.encryption-key` (o nome acompanha o arquivo do banco). Esse arquivo e o banco estão fora do Git. Quem copiar só o `vagas.db` não consegue ler a credencial. Quem copiar o banco e o arquivo de criptografia juntos consegue.

**Remover chave** apaga a credencial do banco. Limpar os registros do kanban não apaga a configuração de IA, o currículo, os critérios nem o SLA.

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `BACKEND_PORT` | `3001` | Porta da API Express |
| `FRONTEND_PORT` | `5173` | Porta do Vite |
| `DATABASE_PATH` | `./data/vagas.db` | Arquivo SQLite |
| `RESUME_PATH` | `./resume.md` | Caminho inicial do currículo, se ainda não houver valor no banco |
| `SEARCH_QUERY_PATH` | `./search-query.txt` | Caminho inicial dos critérios de busca |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origem liberada no CORS. Também é enviada ao OpenRouter como `HTTP-Referer` |
| `ADZUNA_APP_ID` | vazio | Opcional. Liga o provider Adzuna |
| `ADZUNA_APP_KEY` | vazio | Opcional. Liga o provider Adzuna |
| `LINKEDIN_CLIENT_ID` | vazio | Opcional. Liga o provider LinkedIn |
| `LINKEDIN_CLIENT_SECRET` | vazio | Opcional. Liga o provider LinkedIn |
| `LINKEDIN_ACCESS_TOKEN` | vazio | Opcional. Token manual; se vazio, a API tenta Client Credentials |
| `LINKEDIN_API_VERSION` | `202603` | Versão da API REST do LinkedIn |
| `LINKEDIN_MAX_RESULTS` | `50` | Limite de vagas do LinkedIn por busca (máximo 100) |

Deixe vazias as chaves de provider que você não for usar. Não coloque a chave do OpenRouter neste arquivo.

## Uso

### Buscar vagas

1. Ajuste `resume.md` e `search-query.txt`.
2. No kanban, clique em **Buscar vagas**.
3. Revise cargo, tecnologias, remoto e localização. Os valores iniciais saem desses dois arquivos.
4. A aplicação consulta os providers em paralelo, calcula o score e ignora URL duplicada.

Com IA configurada, a busca pede ao modelo um refinamento do perfil e dos filtros. Se a chamada falhar, a busca continua com as regras locais. O custo entra em **Gastos IA** como *Análise de perfil para busca*.

| Provider | Credencial |
|----------|------------|
| Remote OK | Nenhuma |
| Remotive | Nenhuma |
| Arbeitnow | Nenhuma |
| Jobicy | Nenhuma |
| Adzuna | `ADZUNA_APP_ID` e `ADZUNA_APP_KEY` |
| LinkedIn | Credenciais no `.env`. A busca tenta a API `jobSearch` e, sem acesso, o endpoint público de vagas |

### Importar um JSON

No kanban, **Importar JSON** aceita um arquivo com `searchCriteria`, `candidateProfile` e `jobs[]`. Vagas com score geral de 70% ou menos ficam de fora. URL já cadastrada é ignorada. O histórico fica em **Importações**.

`job-search-results.example.json` mostra o formato. A skill `job-search-and-match` do Cursor pode gerar um arquivo nesse formato a partir de `companies.json`; o resultado real, `job-search-results.json`, também fica fora do Git.

### Kanban

As colunas são: vagas encontradas, CV gerado, aplicadas, entrevista, entrevista técnica, aprovação e cancelada. Dá para arrastar os cards, abrir a vaga, comentar e apagar. Em **Configurações** o SLA define em quantos dias cada etapa entra em atenção ou estado crítico.

### Gerar currículo

Na vaga, escolha o idioma (pt-BR, en-US ou es-ES) e clique em **Gerar CV**. O modelo reescreve o currículo base para a vaga, sem inventar experiência, em Markdown de até cerca de duas páginas. Depois use **Copiar**, **Baixar .md** ou **Baixar PDF**. O PDF é montado no navegador.

Sem chave e modelo salvos, a API responde `503` e pede a configuração.

### Gastos de IA

**Gastos IA** soma tokens e custo. Se o OpenRouter devolver o custo da chamada, esse número é o gravado. Caso contrário, o custo é estimado pelo preço do modelo no catálogo.

## O que não vai para um repositório público

Estes caminhos estão no `.gitignore`:

- `.env`
- `resume.md`, `search-query.txt` e `job-search-results.json`
- `data/vagas.db` e o arquivo `.encryption-key` ao lado dele
- `node_modules/` e `dist/`

Publique os exemplos (`*.example.md`, `*.example.txt`, `*.example.json`) e o `.env.example`, que não tem segredo.

## Estrutura

```
applyai/
├── resume.example.md
├── search-query.example.txt
├── job-search-results.example.json
├── companies.json            # plataformas usadas pela skill do Cursor
├── client/                   # React + Vite + Tailwind
├── server/                   # Express, SQLite e cliente compatível com OpenAI apontado ao OpenRouter
│   └── test/                 # testes da API
└── data/                     # banco e chave de criptografia, fora do Git
```

## Stack

- Frontend: React 19, Vite 8, Tailwind CSS 4, TanStack Query 5, dnd-kit, marked, html2canvas e jsPDF
- Backend: Express 5, better-sqlite3 12, SDK OpenAI 6 usado contra a API compatível do OpenRouter, multer 2 e dotenv 17
- Node.js 20+

## Problemas comuns

**`ECONNREFUSED` no proxy do Vite.** A API não está no ar, ou `BACKEND_PORT` não é a porta que o Vite espera. Rode `npm run dev` na raiz.

**`better_sqlite3.node` ou `ERR_DLOPEN_FAILED`.** O módulo nativo foi compilado com outro Node.

```bash
nvm use
npm install --prefix server
```

**A lista de modelos não carrega o catálogo completo.** A tela avisa e mostra a lista local. A geração de currículo continua disponível para um modelo dessa lista, desde que a chave esteja salva.

**A chave salva não pode ser lida.** O arquivo de criptografia ao lado do banco foi apagado ou trocado. Informe a chave de novo em Configurações.
