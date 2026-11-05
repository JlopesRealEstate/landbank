# Land Bank & Warehouse CRM

Sistema de gestão de áreas e inteligência territorial para operações de land bank, imóveis industriais e logísticos.

## Módulos incluídos

- Dashboard e indicadores do portfólio
- Cadastro, edição e consulta de áreas
- Mapa e visualização geográfica
- Gestão de mídias e fichas de áreas
- Restrições, características do terreno e análise de relevo
- Inteligência territorial e enriquecimento de dados municipais/IBGE
- Consultas, relatórios e apresentações compartilháveis
- Supabase PostgreSQL + Auth + RLS (migração em andamento)\n- Drizzle ORM mantido temporariamente para os módulos legados

## Stack

- Next.js 16 / React 19 / TypeScript
- PostgreSQL
- Drizzle ORM
- Tailwind CSS 4
- Leaflet / React Leaflet

## Requisitos

- Node.js 20.9 ou superior
- PostgreSQL 14 ou superior
- npm

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Configure `DATABASE_URL` com a URL do PostgreSQL.
3. Configure as chaves externas apenas se for usar os recursos correspondentes.
4. Instale e execute:

```bash
npm install
npm run dev
```

Aplicação: http://localhost:3000

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |\n| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do cliente Supabase (RLS obrigatória) |\n| `DATABASE_URL` | Conexão PostgreSQL legada, necessária até migrar os módulos Drizzle |
| `GOOGLE_MAPS_API_KEY` | Serviços Google Maps no servidor, quando habilitados |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Recursos de mapa no navegador, quando habilitados |
| `RESEND_API_KEY` | Envio de e-mails via Resend, quando habilitado |
| `RESEND_FROM` | Remetente autorizado no Resend |

Nunca publique valores reais de chaves, senhas ou tokens no repositório.

## Banco de dados

O CRM possui uma estrutura Supabase com autenticação e RLS. O aplicativo original ainda possui módulos que usam Drizzle ORM e inicializam/verificam dados por `src/db/bootstrap.ts`; esses módulos continuam dependendo de `DATABASE_URL` até a migração de consultas e gravações.

Antes de executar migrações ou rotinas de seed em produção, revise o schema e faça backup do banco.

## Scripts

- `npm run dev` — ambiente de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — servidor de produção
- `npm run lint` — análise ESLint
- `npm run typecheck` — verificação TypeScript

## Segurança — pendências antes de produção

Esta entrega é a publicação do código-base, não uma certificação de segurança. Revise especialmente:

- Autenticação e autorização por perfil/usuário para rotas e páginas internas.
- Proteção dos endpoints administrativos, incluindo `/api/seed`.
- Validação de origem, rate limiting e controles para links de compartilhamento.
- Segredos e chaves exclusivamente em variáveis de ambiente.
- Backups, política de retenção e permissões do PostgreSQL.

Não disponibilize dados de proprietários, negociações ou documentos sensíveis em uma instância pública sem concluir essa etapa.

## Deploy na Vercel

1. Importe este repositório no painel da Vercel.
2. Configure o projeto como Next.js (detecção automática).
3. Cadastre `DATABASE_URL` nas Environment Variables da Vercel para Production, Preview e Development.
4. Use um PostgreSQL gerenciado com TLS e backups habilitados.
5. Faça o primeiro deploy somente após concluir autenticação e autorização.
6. Configure as demais chaves opcionais apenas quando os respectivos recursos forem utilizados.

O arquivo `vercel.json` contém as configurações básicas de build. Não há credenciais incluídas no repositório.

## Bloqueios de produção

- O endpoint público `/api/seed` foi desativado em produção para impedir escrita não autenticada.
- O CRM ainda precisa de autenticação real, autorização por perfil e proteção de todas as rotas de dados antes de receber informações comerciais.
- Não use dados reais enquanto essas proteções não estiverem implementadas e testadas.

## Publicação do código-fonte

O arquivo original `FINAL_5_land-bank-and-warehouse-crm.zip` foi mantido no histórico do repositório. O workflow **Expand CRM source** extrai os 109 arquivos do pacote para a raiz do projeto e registra o código-fonte em um novo commit, sem apagar o ZIP original.


## Supabase — EldoradoCorp CRM

- Projeto: `EldoradoCorp CRM` (`bephigzcfsaltsexsimm`)
- Região: São Paulo (sa-east-1)
- API URL: `https://bephigzcfsaltsexsimm.supabase.co`
- Migrations versionadas: `202611050001_initial_eldoradocorp_crm.sql`, `202611050002_security_hardening.sql` e `202611050003_landbank_operational_schema.sql` e `202611050004_landbank_private_storage.sql`
- Auth SSR: `src/lib/supabase/client.ts`, `server.ts` e `proxy.ts`
- Login: `/login`

O banco contém as tabelas do CRM comercial (`companies`, `contacts`, `properties`, `opportunities`, `tasks`, `viability_studies`, `share_links`, `audit_log`) e as tabelas do Land Bank original (`areas`, `media`, `ibge_cities`, `activities`, `area_restrictions`, `terrain_analyses`, `market_news`). As 17 tabelas públicas estão com RLS habilitado. O bucket privado `landbank-files` armazena fotos, documentos e arquivos KMZ com limite de 9 MB, tipos MIME permitidos e políticas próprias de Storage. Novos uploads usam `storage_path`; a coluna `data` permanece apenas para leitura de anexos legados. Os registros corporativos de Land Bank estão compartilhados entre usuários autenticados; ações de exclusão ficam restritas ao administrador. Usuários começam como `member`; ninguém pode se promover a administrador pelo cliente. O papel inicial de administrador deve ser atribuído manualmente pelo proprietário do projeto após criar o usuário autorizado, usando SQL Editor no Supabase:

```sql
-- Substitua pelo UUID do usuário autorizado, conferido em Authentication > Users.
insert into public.user_roles (user_id, role)
values ('UUID-DO-USUARIO-AUTORIZADO', 'admin')
on conflict (user_id) do update set role = 'admin';
```

Não use service-role key no navegador ou no GitHub. Configure apenas a publishable key nas variáveis `NEXT_PUBLIC_*`; a RLS é obrigatória. Links de compartilhamento ainda não têm endpoint público de resolução e permanecem privados por padrão.

**Status real da integração (05/11/2026):** projeto Supabase ativo; usuário `jlopes@tecnolopes.com.br` verificado com papel `admin`; 17 tabelas públicas com RLS; tabelas operacionais Land Bank criadas; clientes Supabase SSR e tela de login no repositório. A autenticação Supabase protege as rotas da aplicação. Upload e entrega de anexos de áreas já usam o bucket privado Supabase Storage; o cadastro/listagem principal de áreas, análises de terreno e indicadores ainda possuem consultas legadas Drizzle/PostgreSQL e seguem em migração. Variáveis de ambiente na Vercel, build remoto e login em produção ainda não foram validados. Não cadastrar dados comerciais reais até concluir essa migração e os testes.
