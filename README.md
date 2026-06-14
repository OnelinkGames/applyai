# ApplyAI — Vagas Kanban

Aplicação local para gerenciar candidaturas a vagas de tecnologia. O fluxo começa com uma busca automatizada de vagas (via skill do Cursor), continua com a importação dos resultados e termina no acompanhamento visual no kanban — incluindo geração de CV adaptado por vaga com IA.

## O que ela faz

| Etapa | Onde acontece | Descrição |
|-------|---------------|-----------|
| 1. Busca e matching | Skill `job-search-and-match` (Cursor) | Busca vagas, calcula scores de compatibilidade e gera `job-search-results.json` |
| 2. Importação | App web (Kanban) | Importa o JSON; vagas com score ≤ 70% são filtradas; duplicatas por URL são ignoradas |
| 3. Pipeline | App web (Kanban) | Arraste vagas entre colunas: encontrada → CV gerado → aplicada → entrevistas → aprovação/cancelada |
| 4. CV por vaga | App web (modal da vaga) | Adapta o `resume.md` base para a vaga com OpenAI (Markdown, PDF, cópia) |
| 5. Acompanhamento | App web | Comentários por vaga, histórico de importações e custos estimados de IA |

## Fluxo completo

```
resume.md + search-query.txt + companies.json
              │
              ▼
   Skill job-search-and-match (Cursor Agent)
              │
              ▼
      job-search-results.json
              │
              ▼
   ApplyAI — Importar JSON → Kanban → Gerar CV
```

### Etapa 1 — Busca de vagas (skill `job-search-and-match`)

Esta etapa **não roda dentro da aplicação web**. Ela é executada no Cursor Agent usando a skill instalada em `~/.cursor/skills/job-search-and-match/`.

**Arquivos de entrada** (na raiz do projeto):

| Arquivo | Função |
|---------|--------|
| `resume.md` | Histórico profissional do candidato |
| `search-query.txt` | Critérios da busca (cargo, tech, salário, remoto, etc.) |
| `companies.json` | Lista de plataformas/empresas onde buscar vagas |

**Saída:** `job-search-results.json` — JSON com critérios da busca, perfil do candidato, lista de vagas ordenadas por score e um resumo (`summary`).

Para executar, peça ao agente no Cursor algo como:

> Busque vagas compatíveis com meu perfil usando a skill job-search-and-match.

A skill valida os três arquivos de entrada, busca vagas nas plataformas configuradas, calcula compatibilidade (tecnologias 40%, experiência 30%, salário 20%, localização 10%) e grava o resultado na raiz do workspace.

### Etapa 2 — Importar na aplicação

1. Inicie a aplicação (`npm run dev`).
2. Na página **Kanban**, clique em **Importar JSON**.
3. Selecione o `job-search-results.json` gerado pela skill.

Regras de importação:

- Apenas vagas com **score geral acima de 70%** entram no kanban.
- Vagas com a mesma URL já cadastrada são ignoradas (duplicatas).
- Campos obrigatórios no JSON: `searchCriteria`, `candidateProfile` e `jobs[]`.

### Etapa 3 — Gerenciar no kanban

Colunas do pipeline:

1. **Vagas encontradas** — recém-importadas
2. **CV gerado** — após gerar currículo adaptado
3. **Aplicadas**
4. **Entrevista**
5. **Entrevista técnica**
6. **Aprovação**
7. **Cancelada**

Arraste os cards entre colunas ou abra uma vaga para ver detalhes, scores, comentários e link original.

### Etapa 4 — Gerar CV adaptado

Em **Configurações**, informe o caminho do currículo base (`resume.md`) e o idioma padrão do CV (pt-BR, en-US ou es-ES).

Na modal de uma vaga, use **Gerar CV**. A aplicação envia o currículo base + dados da vaga para a OpenAI e produz um Markdown otimizado para ATS, sem inventar informações. É possível copiar, baixar `.md` ou exportar PDF.

> Requer `OPENAI_API_KEY` configurada no `.env`.

## Pré-requisitos

- Node.js 18+
- Cursor com a skill `job-search-and-match` (para a etapa de busca)
- Chave da OpenAI (apenas para geração de CV)

## Configuração

### 1. Arquivos de busca (raiz do projeto)

Edite antes de rodar a skill:

- **`resume.md`** — seu currículo completo em Markdown
- **`search-query.txt`** — critérios de busca em texto livre
- **`companies.json`** — array JSON com nomes de plataformas (ex.: `"LinkedIn Jobs"`, `"Gupy"`, `"Remote OK"`)

Se algum arquivo não existir, a skill cria templates e pede para você preenchê-los antes de continuar.

### 2. Variáveis de ambiente

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OPENAI_API_KEY` | — | Obrigatória para gerar CVs |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo usado na geração de CV |
| `PORT` | `3001` | Porta do servidor Express |
| `DATABASE_PATH` | `./data/vagas.db` | Banco SQLite local |
| `RESUME_PATH` | `./resume.md` | Caminho padrão do currículo (também configurável na UI) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origem CORS do frontend |

### 3. Instalar dependências

```bash
npm install
npm install --prefix server
npm install --prefix client
```

## Executar

```bash
npm run dev
```

Isso sobe:

- **Backend:** http://localhost:3001 (`/api`)
- **Frontend:** http://localhost:5173

Comandos individuais:

```bash
npm run dev:server   # só API
npm run dev:client   # só Vite
npm run build        # build de produção do client
```

## Páginas da aplicação

| Rota | Função |
|------|--------|
| `/` | Kanban — importação e pipeline de vagas |
| `/ai-costs` | Gastos estimados com tokens da OpenAI |
| `/settings` | Currículo base, idioma padrão, histórico de importações e limpeza do banco |

## Formato do JSON de importação

O arquivo `job-search-results.json` segue o contrato definido pela skill `job-search-and-match`. Estrutura mínima:

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
├── resume.md                 # Currículo base (entrada da skill e geração de CV)
├── search-query.txt          # Critérios de busca (entrada da skill)
├── companies.json            # Plataformas de vagas (entrada da skill)
├── job-search-results.json   # Saída da skill → importado no kanban
├── client/                   # React + Vite + Tailwind
├── server/                   # Express + SQLite + OpenAI
├── data/                     # Banco SQLite (gitignored)
└── .env                      # Segredos e configuração local
```

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query, dnd-kit
- **Backend:** Express, better-sqlite3, OpenAI SDK, multer
- **Busca de vagas:** Cursor Agent + skill `job-search-and-match`
