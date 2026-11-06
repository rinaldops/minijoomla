# Segurança

MINIJOOMLA é um projeto independente em preparação para distribuição open
source. Não há, atualmente, uma linha de releases públicas com garantia de
suporte de segurança ou prazo de correção. Esta política descreve limites e
como comunicar problemas; não certifica segurança para produção.

## Correção do sanitizador — 05/11/2026

A passada única por regex permitia que `<<x>img src=x onerror=alert(1)>` virasse
uma tag executável. O sanitizador agora emite somente tags que ele próprio gerou
e escapa todo o texto restante (corrigido a partir da 0.4.1).

**Ação do responsável:** versões publicadas antes da 0.4.1, inclusive as
releases corporativas 0.2.x, carregam o sanitizador antigo e precisam ser
atualizadas ou retiradas.

## Relatar uma vulnerabilidade

Não publique payloads exploráveis, credenciais, dados pessoais ou detalhes de
uma instalação real em issues, pull requests ou logs públicos.

- Se o repositório oferecer **Security → Report a vulnerability**, use esse
  canal privado.
- Caso essa opção não exista, solicite aos mantenedores um canal privado,
  sem incluir detalhes técnicos sensíveis na solicitação pública. Aguarde um
  canal confirmado antes de enviar a reprodução completa; nenhum endereço de
  contato específico é prometido por este documento.
- Envie versão/revisão afetada, comportamento esperado, passos mínimos com
  dados sintéticos, impacto e pré-condições. Evite anexar dumps ou capturas de
  ambientes reais. Se houver correção proposta, compartilhe-a privadamente.
- Teste apenas em sistemas próprios ou expressamente autorizados. Não faça
  varreduras, exploração, gravação ou acesso a dados de terceiros.

Os mantenedores devem confirmar o recebimento, avaliar o impacto e combinar a
divulgação com o relator. Não há SLA garantido. Vulnerabilidades de bibliotecas
externas também precisam ser avaliadas com seus respectivos mantenedores;
não presuma que a cópia vendorizada recebe atualizações automaticamente.

## Fronteiras de confiança

### Autenticação e autorização

O núcleo e o painel **não implementam autenticação, usuários ou ACL própria**.
Esconder botões, rotas ou o painel não impede acesso ao backend. Qualquer host
em rede precisa aplicar autenticação e autorização de leitura/escrita no
servidor ou serviço de dados, independentemente da UI. Não hospede um painel
com escrita anônima nem trate MINIJOOMLA como CMS multiusuário pronto.

As demonstrações usam dados sintéticos e armazenamento local na origem do
navegador. Esse armazenamento não é um cofre, nem isolamento por usuário.
Não armazene nele segredos ou conteúdo sensível. ETags ajudam a detectar
concorrência; não concedem autorização nem substituem uma trilha de auditoria.

### Conteúdo, URLs e uploads

`src/libraries/minijoomla/security/` contém escaping e sanitização de conteúdo/URLs; esses controles
são limitados aos contratos usados pelo projeto. Não constituem um sanitizador
HTML/CSS universal e não substituem validação no backend. O HTML público aceita
um conjunto estreito de elementos/atributos; margens de imagem são numéricas e
limitadas, sem CSS arbitrário. URLs executáveis e imagens `data:`/`blob:` não
devem ser persistidas como solução alternativa a uploads.

O host deve aplicar limites de tamanho, MIME e conteúdo real, nomes/caminhos
seguros, autorização, armazenamento apropriado e política de serviço dos
arquivos enviados. Não confie só na extensão ou no MIME declarado pelo cliente.
Dados de repositories, parâmetros e conteúdo editorial precisam ser tratados
como entrada não confiável em cada saída HTML/URL.

### Extensões e configuração

Módulos, plugins e templates JavaScript carregados dinamicamente executam no
contexto da página. São **código confiável**, não uma sandbox para contribuições
ou conteúdo de usuários. Restrinja quem pode editar seus entrypoints e
configurações; revise o código e use URLs de versão imutáveis. Cache de import
não verifica integridade nem garante atualização automática.

Proteja a origem e a configuração do host, use HTTPS e uma CSP adequada, e
revise permissões e dependências antes de publicar. Não coloque tokens, cookies
ou chaves em código, parâmetros públicos, assets ou arquivos versionados.
Controles de TLS, proxy e proteção de dados não devem ser desativados para
instalar dependências ou fazer uma integração funcionar.

## Validação e distribuição

`npm test` cobre regressões locais e mostra explicitamente integrações
opcionais não executadas. Testes de contratos com doubles locais não comprovam
permissões de backend, proteção de upload real ou segurança em um host em rede.
Mesmo com SPMIDDLE presente, a suíte Node não é autorização para acessar um
serviço externo e não substitui testes de implantação autorizados.

Antes de uma release, revise dependências e procedência dos ativos, saneie os
arquivos selecionados para distribuição e registre limites e rollback.
Consulte [CONTRIBUTING.md](CONTRIBUTING.md),
[OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md) e
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Não publique configurações,
evidências nem histórico de ambientes como parte de uma distribuição genérica.
