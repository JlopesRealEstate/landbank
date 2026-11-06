# Histórico de versões — Land Bank Corp

## 1.4.1 — 06/11/2026
- Corrige a leitura dos metadados de fotos privadas: após validar sessão e perfil autorizado, a rota `/api/media/[id]` consulta a tabela `media` pelo cliente administrativo server-only, evitando bloqueio indevido por RLS na consulta de sessão.
- O download do objeto continua no bucket privado `landbank-files`; nenhuma foto foi tornada pública.
- Menu desktop e drawer mobile passam a separar navegação rolável do rodapé fixo, mantendo ações de conta e Logoff visíveis.
- Publicação pendente de confirmação de build e deploy da Vercel.


## 1.4.0 — 06/11/2026
- Commit de referência da versão: `30aa4ec` (versão e metadados do release).
- Situação: registrada no código-fonte; ainda não publicada em produção devido ao limite temporário de deploy da Vercel.
- Corrige erro de TypeScript que impedia a publicação das versões 1.3.8 e 1.3.9.
- Menu lateral desktop e mobile passa a ter rolagem vertical, com rodapé e ações da conta sem corte.
- Mantém leitura segura das fotos e documentos do Supabase para todos os perfis autenticados autorizados.


## 1.3.9 — 06/11/2026
- Corrige o menu da conta: ações de senha/login em grade e botão de saída em largura total, sem corte.
- Corrige o rodapé do menu mobile, passando a receber o perfil administrativo corretamente e permitindo rolagem.
- Carrega metadados de fotos e documentos diretamente da tabela oficial `media` do projeto Supabase, evitando divergência da conexão Drizzle.
- Recupera arquivos privados com chave administrativa apenas no servidor, após validar sessão e perfil autorizado.
- Mantém bucket privado e permite leitura a administradores, membros e leitores autenticados.
- Adiciona fallback visual quando uma foto de capa não puder ser carregada.


## 1.3.8 — 06/11/2026
- Define administradores como únicos usuários autorizados a cadastrar, editar, excluir imóveis e enviar arquivos.
- Perfis `member` e `reader` passam a operar em modo somente leitura, mantendo consulta integral e geração de fichas PDF.
- Oculta no menu e bloqueia por URL os módulos Controle de Acessos e Relatórios para não administradores.
- Adiciona validação de autorização no servidor e proteção nas rotas de imóveis e upload de mídia.
- Mantém o administrador principal e os dados existentes sem alteração.


## 1.3.7 — 06/11/2026
- Corrige a consulta administrativa de usuários: prioriza `SUPABASE_SECRET_KEY` (chave secreta atual) e mantém `SUPABASE_SERVICE_ROLE_KEY` como compatibilidade.
- Corrige falha em produção causada por chave administrativa inválida no cliente Auth Admin.
- Registra diagnósticos sanitizados para diferenciar falhas no Auth Admin e na tabela `user_roles`, sem expor credenciais.
- Mantém verificação da sessão autenticada e do perfil `admin` antes de listar, convidar ou alterar usuários.


## 1.3.6 — 06/11/2026
- A tela de recuperação identifica `email rate limit exceeded`, informa bloqueio temporário e evita tentativas repetidas no mesmo carregamento.
- Mantém redirecionamento para `/auth/confirm?next=/definir-senha`.
- Templates de e-mail do Supabase devem usar `{{ .TokenHash }}` com `/auth/confirm`; a alteração desses modelos é feita no painel Supabase, não no repositório.


## 1.3.5 — 06/11/2026
- Adiciona endpoint `/auth/confirm` com `verifyOtp(token_hash)` para recuperação e convites, sem depender do cookie PKCE do navegador que solicitou o e-mail.
- Persiste explicitamente os cookies de sessão na resposta de confirmação.
- Recuperação de senha e convites passam a apontar para o endpoint de confirmação por token hash.
- Mantém a rota de definição de senha acessível para validação visual, mas exige sessão Supabase verificada para salvar.


## 1.3.4 — 06/11/2026
- Libera somente a rota de definição de senha para carregar antes da sessão; a gravação exige usuário verificado pelo Supabase.
- Formulário de nova senha sempre visível, com detecção de sessão PKCE/implicit e mensagem explícita para link expirado.
- O proxy continua bloqueando rotas internas e APIs sem usuário autenticado e perfil autorizado.
- O AppShell redireciona ao login quando a sessão do Supabase desaparece, sem exibir o CRM como sessão desconhecida.


## 1.3.3 — 06/11/2026
- Exibe o e-mail da conta autenticada e ações de senha/login/logoff no rodapé da navegação.
- Remove Atualizações do menu textual e disponibiliza acesso discreto pelo ícone de sino.
- Remove o segundo atalho de Documentação, mantendo apenas o item principal.
- Adiciona recuperação de senha na tela de login com callback de produção e mantém alteração de senha dentro do CRM.
- Confirmação do usuário administrador no Supabase: jlopes@tecnolopes.com.br (perfil admin).

## 1.3.2 — 06/11/2026
- A tela de Controle de Acessos redireciona para login quando a sessão expira e preserva a rota de retorno.
- Requisições administrativas enviam explicitamente cookies same-origin e distinguem sessão expirada de perfil sem permissão.
- Inclui ações Login e Logoff na navegação; o Logoff encerra sessões Supabase globalmente e retorna à tela de login.


## 1.3.1 — 05/11/2026
- Corrige a recuperação de senha para redirecionar explicitamente ao domínio de produção e ao callback PKCE.
- Adiciona ação Esqueci minha senha à tela de login e orienta o usuário a solicitar um link novo.


## 1.3.0 — 05/11/2026
- Corrige validação de autenticação nos endpoints de upload: usa usuário verificado pelo Supabase e trata sessão ausente sem acessar claims nulos.
- Adiciona bloqueio de acesso para contas sem perfil ativo.
- Remove concessão automática de perfil no gatilho de criação do Auth: somente o convite administrativo atribui papel ao novo usuário.
- Aplica políticas RLS restritivas em todas as tabelas públicas e no Storage: contas sem perfil não leem dados; leitores não gravam; administradores preservam a gestão.
- Adiciona painel administrativo para convite, alteração de perfil e revogação de acesso.
- Adiciona callback PKCE e definição individual de senha para usuários convidados.
- Recolhe por padrão o quadro Restrições e perda de área.
- Adiciona botão Restrições no mapa do portfólio para exibir curvas e polígonos do imóvel selecionado.
- Exporta curvas de nível em equidistância cartográfica de 1 m no PDF quando a grade MDE está disponível.
- Remove seção topográfica duplicada do PDF.
- Centraliza versão do CRM e histórico de releases.
- Registra e aplica as migrações Supabase 005 e 006 para Storage privado por perfil e bloqueio de acesso direto às tabelas sem autorização.

## 1.2.0 — 05/11/2026
- Dossiê digital, uploads privados e mapas de demarcação.

## 1.1.0 — 05/11/2026
- Estrutura inicial do Land Bank Corp.

---

## Regra obrigatória para toda publicação
1. Atualizar `package.json.version` e `src/lib/version.ts` com a mesma versão SemVer.
2. Adicionar uma entrada no topo deste arquivo e em `src/app/(app)/atualizacoes/page.tsx`.
3. Registrar data, resumo funcional, migrações, testes executados e commit de origem.
4. Executar typecheck, lint e build antes de publicar.
5. Confirmar deployment Vercel como READY e testar login, permissões, APIs, uploads e telas afetadas.
6. Não promover uma versão com build falho ou sem testes essenciais.
