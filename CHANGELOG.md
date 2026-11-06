# Histórico de versões — Land Bank Corp

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
