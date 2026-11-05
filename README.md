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
- Base PostgreSQL com Drizzle ORM

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
| `DATABASE_URL` | Conexão PostgreSQL (obrigatória) |
| `GOOGLE_MAPS_API_KEY` | Serviços Google Maps no servidor, quando habilitados |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Recursos de mapa no navegador, quando habilitados |
| `RESEND_API_KEY` | Envio de e-mails via Resend, quando habilitado |
| `RESEND_FROM` | Remetente autorizado no Resend |

Nunca publique valores reais de chaves, senhas ou tokens no repositório.

## Banco de dados

O projeto usa Drizzle ORM e inicializa/verifica a estrutura de dados por meio de `src/db/bootstrap.ts`. A conexão da aplicação é lida de `DATABASE_URL`.

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
