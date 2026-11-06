# CLAUDE.md

Guia para agents (e humanos) trabalhando neste repo. Leia antes de mudar código.

## Stack

- **Monorepo pnpm** (versão fixa em `packageManager`), Node 22, TypeScript strict em todos os pacotes.
- **`apps/app`**: um único app **Expo** (SDK 58) para iOS, Android e Web, com **Expo Router** (rotas por arquivo em `src/app/`) e **NativeWind** v4 (Tailwind v3 via `className`).
- **`apps/api`**: **Hono** rodando em **Cloudflare Workers** (`wrangler`).
- **`packages/shared`**: schemas **zod**, tipos e o cliente tipado da API via **Hono RPC** (`hc<AppType>`).
- Qualidade: **Biome** (lint + format), **Vitest** (api e shared), **jest-expo + Testing Library** (app), `expo export --platform web` no build e `expo-doctor` no CI.
- Banco Neon + Drizzle e login com Better Auth chegam no APP-2; deploy e previews no APP-3.

## Comandos (na raiz)

- `pnpm install`: instala tudo (workspaces).
- `pnpm dev`: sobe API (`:8787`) e Expo juntos. Para usar os atalhos do Expo (`i`, `a`, `w`), rode `pnpm dev:api` e `pnpm dev:app` em terminais separados.
- `pnpm lint`: Biome (lint + formatação + imports), sem escrever.
- `pnpm format`: Biome com `--write` (corrige formatação e o que for seguro).
- `pnpm typecheck`: `tsc --noEmit` em todos os pacotes.
- `pnpm test`: Vitest (api, shared) e Jest (app).
- `pnpm build`: bundle da API (`wrangler deploy --dry-run`) e export web do app (`expo export --platform web`).
- `pnpm check`: **lint + typecheck + test**. É o que agents e CI rodam. Tem que ficar verde.
- `pnpm --filter @repo/app run doctor`: `expo-doctor` (dependências e config do Expo). Use `run`, porque `pnpm doctor` é um comando do próprio pnpm.

A partir do APP-2 também existirão `pnpm db:generate` e `pnpm db:migrate`.

Comandos por pacote: `pnpm --filter @repo/api <script>`, `pnpm --filter @repo/app <script>`, `pnpm --filter @repo/shared <script>`.

## Estrutura

```
apps/
  api/                    Hono no Cloudflare Workers
    src/app.ts            app Hono: middlewares + todas as rotas encadeadas; exporta AppType
    src/routes/*.ts       uma sub-app Hono por recurso (ex.: health.ts)
    src/env.ts            tipo das bindings (vars, secrets) do Worker
    wrangler.jsonc        config do Worker (vars não secretas)
  app/                    Expo (iOS, Android, Web)
    src/app/              rotas do Expo Router (cada arquivo é uma tela)
      _layout.tsx         layout raiz (Stack + tema + global.css)
      (tabs)/             navegação em tabs (index = Início, about = Sobre)
    src/__tests__/        testes de tela e de navegação (fora de src/app, que só tem rotas)
    src/components/       componentes de UI
    src/hooks/            hooks (ex.: use-health)
    src/lib/api.ts        URL da API + cliente tipado
packages/
  shared/
    src/schemas/*.ts      schemas zod + tipos inferidos (contrato entre API e app)
    src/client.ts         createApiClient() = hc<AppType>(url)
```

## Convenções

- **TypeScript strict** em tudo; não use `any` (prefira `unknown` + validação).
- **Biome** manda no estilo: 2 espaços, aspas duplas, 100 colunas, imports organizados. Rode `pnpm format` antes de commitar.
- Nomes de arquivo em `kebab-case` (`health-card.tsx`, `use-health.ts`). Componentes em `PascalCase`.
- **Contrato da API mora em `packages/shared`**: todo request/response tem um schema zod lá. A API valida a entrada com ele e o app valida a resposta com ele.
- **Rotas da API são encadeadas** em `apps/api/src/app.ts` (`.route("/x", xRoutes)`): é isso que faz o `AppType` carregar os tipos para o cliente RPC. Rotas registradas fora da cadeia não aparecem no cliente.
- **Nada de globais do Worker nos arquivos de rota/app da API** (`apps/api/src`): `packages/shared` e o app importam os tipos da API (só tipos) fora do ambiente do Worker. Declare bindings em `src/env.ts` com tipos explícitos.
- **App**: estilize com `className` (NativeWind). Telas só em `src/app/`; o resto (componentes, hooks, libs) fica fora de `src/app/`. Use o alias `@/` para importar de `src/`.
- **URL da API**: `EXPO_PUBLIC_API_URL`. Sem ela, em dev o app usa o host do Metro na porta 8787 (funciona em simulador, emulador e Expo Go na mesma rede). Variáveis `EXPO_PUBLIC_*` vão para o bundle e são públicas.
- **Dependências do app**: instale com `pnpm --filter @repo/app exec expo install <pacote>` (escolhe versões compatíveis com o SDK). Libs com código nativo fora do Expo Go exigem development build.
- **Expo muda a cada SDK**: antes de usar uma API do Expo/React Native, confira a doc da versão instalada (`https://docs.expo.dev/versions/v58.0.0/`) em vez de confiar na memória.
- Testing Library v14: `render`, `fireEvent`, `userEvent` e `renderRouter` são **async**; sempre use `await`.

## Como adicionar uma feature de ponta a ponta

Exemplo: listar `todos`.

1. **Schema em shared**: crie `packages/shared/src/schemas/todo.ts` com os schemas zod (`todoSchema`, `createTodoSchema`, ...) e os tipos (`z.infer`). Exporte em `packages/shared/src/index.ts`. Teste em `todo.test.ts` (Vitest).
2. **Rota na API**: crie `apps/api/src/routes/todos.ts` com `new Hono<AppEnv>()` e os handlers. Valide entrada com o schema de shared (`@hono/zod-validator` ou `schema.parse`) e responda com `c.json(...)`. Encadeie em `apps/api/src/app.ts`: `.route("/todos", todoRoutes)`.
3. **Teste da API**: `apps/api/src/routes/todos.test.ts` com `app.request(...)` ou `testClient(app)` de `hono/testing`.
4. **Tela no app**: chame a API com o cliente tipado (`api.todos.$get()` de `@/lib/api`) dentro de um hook em `src/hooks/`, valide a resposta com o schema de shared e crie a tela em `src/app/` (ex.: `src/app/(tabs)/todos.tsx` + `Tabs.Screen` em `(tabs)/_layout.tsx`).
5. **Testes do app**: teste a tela com Testing Library (mock de `fetch`, como em `src/__tests__/home.test.tsx`) e, se mudou a navegação, `renderRouter` (`navigation.test.tsx`).
6. Rode `pnpm check` (e `pnpm build` se mexeu em config do Expo ou do Worker).

## Regras

- **Nunca commite secrets.** Locais ficam em `apps/api/.dev.vars` e `apps/app/.env.local` (ambos ignorados pelo git); em produção use `wrangler secret put` e os secrets do CI. Nunca coloque secrets em `EXPO_PUBLIC_*` nem em `wrangler.jsonc`.
- **Migrations sempre geradas e commitadas** (`pnpm db:generate`, a partir do APP-2). Não edite migrations já aplicadas.
- **Mantenha `pnpm check` verde.** Não desligue regras do Biome, testes ou o strict do TypeScript para fazer passar.
- Não edite `ios/` e `android/` à mão (são gerados pelo Expo, e estão no `.gitignore`); configure via `app.json` e config plugins.
- Commite o `pnpm-lock.yaml` junto com mudanças de dependência (o CI usa `--frozen-lockfile`).
