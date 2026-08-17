# ApplyAI — Vagas Kanban

Aplicação local para gerenciar candidaturas a vagas de tecnologia. Busque vagas diretamente na interface ou importe resultados de uma skill do Cursor, acompanhe o pipeline no kanban e gere currículos adaptados por vaga com IA.

## O que ela faz

| Etapa | Onde acontece | Descrição |
|-------|---------------|-----------|
| 1. Busca de vagas | App web (Kanban) | Consulta APIs públicas (Remote OK, Remotive, Arbeitnow, Jobicy, Adzuna, LinkedIn), calcula scores e adiciona ao kanban |
| 1b. Busca alternativa | Skill `job-search-and-match` (Cursor) | Busca em plataformas configuradas em `companies.json` e gera `job-search-results.json` |
| 2. Importação | App web (Kanban) | Importa o JSON da skill; vagas com score ≤ 70% são filtradas; duplicatas por URL são ignoradas |
| 3. Pipeline | App web (Kanban) | Arraste vagas entre colunas: encontrada → CV gerado → aplicada → entrevistas → aprovação/cancelada |
| 4. CV por vaga | App web (modal da vaga) | Adapta o `resume.md` base para a vaga com OpenAI (Markdown, PDF, cópia) |
| 5. Acompanhamento | App web | Comentários por vaga, histórico de importações e custos estimados de IA |

## Fluxo completo

```
resume.md + search-query.txt
              │
              ├──────────────────────────────────────┐
              ▼                                      ▼
   Buscar vagas (app web)              Skill job-search-and-match (Cursor)
   APIs: Remote OK, Remotive, ...      companies.json + plataformas configuradas
              │                                      │
              ▼                                      ▼
         Kanban ←──────────────────── job-search-results.json (importar)
              │
              ▼
      Gerar CV adaptado (OpenAI)
```

## Busca de vagas na aplicação

A forma principal de popular o kanban é o botão **Buscar vagas** na página Kanban.

### Como funciona

1. Configure `resume.md` e `search-query.txt` em **Configurações** (caminhos absolutos ou relativos à raiz do projeto).
2. Clique em **Buscar vagas** e ajuste os filtros se necessário (cargo, tecnologias, remoto, localização).
3. A aplicação extrai seu perfil do currículo, aplica os critérios de busca e consulta os providers em paralelo.
4. Cada vaga recebe um score de compatibilidade; apenas vagas **acima de 70%** entram no kanban.
5. URLs duplicadas são ignoradas.

### Providers integrados

| Provider | Autenticação |
|----------|--------------|
| Remote OK | Não requer |
| Remotive | Não requer |
| Arbeitnow | Não requer |
| Jobicy | Não requer |
| Adzuna | Requer `ADZUNA_APP_ID` e `ADZUNA_APP_KEY` no `.env` |
| LinkedIn | Opcional — requer credenciais OAuth no `.env` (ver abaixo) |

Providers sem credenciais configuradas são ignorados automaticamente.

### LinkedIn (opcional)

Com credenciais de um app no [LinkedIn Developer Portal](https://www.linkedin.com/developers/), o provider usa OAuth 2.0 (Client Credentials) para obter um access token — ou aceita um token manual via `LINKEDIN_ACCESS_TOKEN`.

A busca tenta primeiro a API REST `jobSearch` (quando disponível para o app) e, se não houver acesso, utiliza o endpoint público de Jobs Search do LinkedIn (`jobs-guest`), o mesmo usado pelas páginas de busca de vagas.

| Variável | Descrição |
|----------|-----------|
| `LINKEDIN_CLIENT_ID` | Client ID do app LinkedIn |
| `LINKEDIN_CLIENT_SECRET` | Client Secret do app LinkedIn |
| `LINKEDIN_ACCESS_TOKEN` | Token manual (opcional; se omitido, obtido via Client Credentials) |
| `LINKEDIN_API_VERSION` | Versão da API REST (padrão: `202603`) |
| `LINKEDIN_MAX_RESULTS` | Máximo de vagas por busca (padrão: `50`, máx.: `100`) |

Se nenhuma credencial LinkedIn estiver definida, o provider é ignorado silenciosamente — igual ao Adzuna.

### Refinamento com IA (opcional)

Com `OPENAI_API_KEY` definida, a busca pode usar IA para refinar tags e contexto do perfil a partir do `resume.md` e do `search-query.txt`. O custo é registrado em **Gastos IA** (operação *Análise de perfil para busca*).

### Scoring

O score geral é calculado localmente (sem IA), com os pesos:

- Tecnologias: 40%
- Experiência: 30%
- Salário: 20%
- Localização: 10%

## Busca via Cursor (alternativa)

Esta etapa **não roda dentro da aplicação web**. É executada no Cursor Agent com a skill `~/.cursor/skills/job-search-and-match/`.

**Arquivos de entrada** (na raiz do projeto):

| Arquivo | Função |
|---------|--------|
| `resume.md` | Histórico profissional do candidato |
| `search-query.txt` | Critérios da busca (cargo, tech, salário, remoto, etc.) |
| `companies.json` | Lista de plataformas/empresas onde buscar vagas |

**Saída:** `job-search-results.json` — importe no kanban pelo botão **Importar JSON**.

Para executar, peça ao agente no Cursor:

> Busque vagas compatíveis com meu perfil usando a skill job-search-and-match.

## Importar JSON no kanban

1. Inicie a aplicação (`npm run dev`).
2. Na página **Kanban**, clique em **Importar JSON**.
3. Selecione o `job-search-results.json`.

Regras de importação:

- Apenas vagas com **score geral acima de 70%** entram no kanban.
- Vagas com a mesma URL já cadastrada são ignoradas (duplicatas).
- Campos obrigatórios no JSON: `searchCriteria`, `candidateProfile` e `jobs[]`.

O histórico de cada importação fica em **Importações**.

## Gerenciar no kanban

Colunas do pipeline:

1. **Vagas encontradas** — recém-importadas ou buscadas
2. **CV gerado** — após gerar currículo adaptado (atualização automática de status)
3. **Aplicadas**
4. **Entrevista**
5. **Entrevista técnica**
6. **Aprovação**
7. **Cancelada**

Arraste os cards entre colunas ou abra uma vaga para ver detalhes, scores, comentários, link original e ações de CV. É possível remover uma vaga individualmente pela modal (comentários e CVs da vaga também são removidos).

## Gerar CV adaptado

Em **Configurações**, informe o caminho do currículo base (`resume.md`), dos critérios de busca (`search-query.txt`) e o idioma padrão do CV (pt-BR, en-US ou es-ES). Os caminhos podem ser digitados ou selecionados via diálogo de arquivo.

Na modal de uma vaga:

1. Escolha o idioma e clique em **Gerar CV**.
2. Quando a IA concluir, o preview aparece na tela com toast de sucesso.
3. Use **Copiar**, **Baixar .md** ou **Baixar PDF**.

O CV é otimizado para ATS, usa apenas informações do currículo base (sem inventar experiência) e tem limite de ~2 páginas A4. O PDF é gerado no navegador com layout paginado (html2canvas + jsPDF).

> Requer `OPENAI_API_KEY` configurada no `.env`.

## Pré-requisitos

- **Node.js 20+** (o projeto usa `.nvmrc` na raiz — atualmente Node 24; recomendado [nvm](https://github.com/nvm-sh/nvm))
- Chave da OpenAI (geração de CV; refinamento opcional na busca)
- Cursor com a skill `job-search-and-match` (apenas para busca via agente)

## Instalação do zero

Na raiz do repositório:

```bash
# 1. Node correto (evita erro do better-sqlite3)
nvm install    # lê .nvmrc e instala se necessário
nvm use

# 2. Variáveis de ambiente
cp .env.example .env
# Edite .env e preencha pelo menos OPENAI_API_KEY (para gerar CV)

# 3. Dependências (raiz + server + client)
npm install
npm install --prefix server
npm install --prefix client
```

O `postinstall` do server recompila o `better-sqlite3` para a versão do Node em uso. Use **sempre a mesma versão do Node** em todos os terminais (`nvm use` antes de `npm run dev`).

```bash
# 4. Subir a aplicação (API + frontend juntos)
npm run dev
```

Portas padrão (definidas no `.env`): frontend `5173`, API `3001`.

- **Frontend:** http://localhost:5173  
- **API:** http://localhost:3001/api  

Validar que a API responde:

```bash
curl http://localhost:${BACKEND_PORT:-3001}/api/health
# {"ok":true}
```

Opcional — rodar testes após instalar:

```bash
npm test
```

### Problemas comuns

**`ECONNREFUSED` no proxy do Vite**  
O backend não está rodando, ou `BACKEND_PORT` no `.env` não bate com o proxy. Use `npm run dev` na **raiz** (não rode só o client). Em terminais separados: `npm run dev:server` + `npm run dev:client`.

**`better_sqlite3.node` / `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED`**  
O módulo nativo foi compilado para outra versão do Node. Com a versão certa ativa:

```bash
nvm use
cd server
npm rebuild better-sqlite3
```

Ou reinstale: `npm install --prefix server` (dispara o `postinstall`).

## Configuração

### 1. Arquivos de perfil (raiz do projeto)

| Arquivo | Uso |
|---------|-----|
| `resume.md` | Currículo base para geração de CV e extração de perfil na busca |
| `search-query.txt` | Critérios de busca em texto livre (cargo, tech, remoto, senioridade, etc.) |
| `companies.json` | Plataformas para a skill do Cursor (não usado pela busca integrada) |

### 2. Variáveis de ambiente

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OPENAI_API_KEY` | — | Obrigatória para gerar CVs; opcional para refinar busca |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo usado na geração de CV e análise de perfil |
| `BACKEND_PORT` | `3001` | Porta do servidor Express |
| `FRONTEND_PORT` | `5173` | Porta do Vite (frontend) |
| `DATABASE_PATH` | `./data/vagas.db` | Banco SQLite local |
| `RESUME_PATH` | `./resume.md` | Caminho padrão do currículo (também configurável na UI) |
| `SEARCH_QUERY_PATH` | `./search-query.txt` | Caminho padrão dos critérios de busca |
| `CLIENT_ORIGIN` | `http://localhost:${FRONTEND_PORT}` | Origem CORS do frontend (opcional; derivado de `FRONTEND_PORT` se omitido) |
| `ADZUNA_APP_ID` | — | Opcional — habilita provider Adzuna |
| `ADZUNA_APP_KEY` | — | Opcional — habilita provider Adzuna |
| `LINKEDIN_CLIENT_ID` | — | Opcional — habilita provider LinkedIn |
| `LINKEDIN_CLIENT_SECRET` | — | Opcional — habilita provider LinkedIn |
| `LINKEDIN_ACCESS_TOKEN` | — | Opcional — token manual; senão obtido via OAuth Client Credentials |
| `LINKEDIN_API_VERSION` | `202603` | Versão da API REST LinkedIn |
| `LINKEDIN_MAX_RESULTS` | `50` | Limite de vagas retornadas por busca no LinkedIn |

As variáveis opcionais de providers (Adzuna, LinkedIn) podem ficar vazias — a app funciona sem elas.

### 3. Instalar dependências

Se você já seguiu [Instalação do zero](#instalação-do-zero), pode pular esta seção. Caso contrário:

```bash
nvm use
npm install
npm install --prefix server
npm install --prefix client
```

## Executar

```bash
npm run dev
```

Isso sobe:

- **Backend:** `http://localhost:${BACKEND_PORT}` (`/api`) — padrão `3001`
- **Frontend:** `http://localhost:${FRONTEND_PORT}` — padrão `5173`

Comandos individuais:

```bash
npm run dev:server   # só API
npm run dev:client   # só Vite
npm run build        # build de produção do client
npm test             # smoke tests da API + build do client
```

### Testes

```bash
npm test                  # server (supertest) + client (vite build)
npm run test --prefix server   # só smoke tests da API
npm run test --prefix client   # só build de produção
```

Os smoke tests do server cobrem health, jobs, settings, importação JSON e relatório de uso de IA.

## Páginas da aplicação

| Rota | Função |
|------|--------|
| `/` | Kanban — busca, importação e pipeline de vagas |
| `/ai-costs` | Gastos estimados com tokens da OpenAI (CV e busca) |
| `/imports` | Histórico paginado de importações e buscas |
| `/settings` | Currículo base, critérios de busca, idioma padrão e limpeza do banco |

## Formato do JSON de importação

O arquivo `job-search-results.json` segue o contrato da skill `job-search-and-match`. Estrutura mínima:

```json
{
  "searchCriteria": { "position": "...", "technologies": [], "remoteOnly": true },
  "candidateProfile": { "name": "...", "seniority": "...", "mainTechnologies": [] },
  "jobs": [
    {
      "title": "...",
      "company": "...",
      "url": "https://...",
      "location": "...",
      "salary": "...",
      "description": "...",
      "requirements": [],
      "score": {
        "overall": 86,
        "technologies": 90,
        "experience": 80,
        "salary": 100,
        "location": 70
      },
      "matchReasons": [],
      "foundAt": "2026-06-13T15:00:00Z"
    }
  ],
  "summary": { "companiesSearched": 5, "jobsFound": 38, "jobsReturned": 12 }
}
```

Consulte a skill em `~/.cursor/skills/job-search-and-match/SKILL.md` para detalhes de scoring, validação e templates.

## Estrutura do projeto

```
applyai/
├── resume.md                 # Currículo base
├── search-query.txt          # Critérios de busca
├── companies.json            # Plataformas (skill do Cursor)
├── job-search-results.json   # Saída da skill → importar no kanban
├── client/                   # React + Vite + Tailwind
│   └── src/utils/cvPdf.js    # Exportação de CV para PDF
├── server/                   # Express + SQLite + OpenAI
│   ├── src/app.js            # Factory do app Express (usado em testes)
│   ├── src/providers/        # Integrações de busca de vagas
│   └── test/smoke.test.js    # Smoke tests da API
├── data/                     # Banco SQLite (gitignored)
└── .env                      # Segredos e configuração local
```

## Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, TanStack Query 5, dnd-kit, marked 18, html2canvas, jsPDF 4
- **Backend:** Express 5, better-sqlite3 12, OpenAI SDK 6, multer 2, dotenv 17
- **Busca de vagas:** providers HTTP integrados + skill opcional `job-search-and-match` no Cursor
- **Node:** 20+ (`.nvmrc` na raiz; `postinstall` recompila `better-sqlite3` no server)
