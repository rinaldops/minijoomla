# Hero — ciclo isolado de desenvolvimento e teste no site

> **Resultado:** Hero adaptado e testado em duas revisões de ensaio, sem
> instalação/configuração persistida. **0.15.0, oito raízes e todos os 48 itens/
> ETags preservados**, ambas páginas publicadas. Regressão final: **89 suítes
> aprovadas, zero skips/falhas**. Este ciclo fecha o ensaio delimitado, não a
> adoção no site nem o grupo definitivo dos sete módulos.

Iniciado em 08/11/2026, base `5f7994a`, branch isolada
`feat/joomla-finalization-step2`. Baseline: release 0.15.0, oito raízes aprovadas
e 48 registros. **Esta rodada não instala Hero nem usa vagas do host.**

## Iteração 1 — desenvolvimento e teste da origem

Hero original: sete parâmetros (`title`, `rotatingWords`, `mission`, `imageUrl`,
`imageAlt`, `primaryAction`, `secondaryAction`), texto/imagem/ações de apresentação.
Só a primeira palavra é exibida; não há rotação, timers ou backend implementados.
Helper de URL por prefixo, imagem recusada ainda podendo gerar src vazio,
objetos não tipados e identificador fixo requerem adaptação defensiva.

Ensaio read-only no site, HTML neutro gerado pelo renderer original revisado,
CSS original e root temporário de 320 px. Viewport de 921 px acionou duas colunas
de 160 px. Título sem espaços criou scroll de 4050 px e root de 4087 px; duas
instâncias tiveram dois IDs `camap-hero-title`. Sem imagem, mídia ocupou a segunda
coluna, sem função. Não houve instalação/gravação de registros.

O primeiro ensaio por style inline preservava BOM no texto, resultando em regra
inicial não aplicada; fixture corrigida retirou BOM somente para injeção inline,
equivalente à decodificação externa CSS. Bytes de fonte/pacote não foram alterados
por essa correção de teste. Contraprova confirmou overflow/IDs repetidos com o
grid efetivo aplicado; não considerar a primeira leitura como comportamento do
arquivo externo corretamente carregado.

## Iteração 2 — retorno ao desenvolvimento

Preparar somente três alterações identificadas em snapshot novo:

- Reusar política URL estrita. Imagem deve ser HTTPS/server-relative válida,
  nunca fragmento ou fallback src vazio; imagem inválida omitida. Ações de objeto
  próprio/inertes, label/target strings; dados inválidos/accessors não executados.
- Retirar ID global fixo, manter título/landmark acessível e declarar a diferença.
  Preservar schema/defaults e desconhecidos no armazenamento; não é sandbox de
  Proxies/código arbitrário nem alteração de parâmetros Joomla avançados.
- CSS só do Hero: textos quebráveis e min-width zero; root sem imagem válida
  usa uma coluna e omite região de mídia vazia. Grid original com imagem mantido.

Repetir testes com os pacotes finais e os dois cenários de imagem, texto longo,
ações, teclado, import/render e limpeza do root/CSS; parâmetros/edit apenas em
fixture de memória explícita se necessário, nunca listas atuais para esse ensaio.

## Iteração 3 — pacotes finais e teste isolado no site

**Desenvolvimento:** `scripts/prepare-hero-adaptation.js` produz um perfil fechado
com três patches de arquivos: helper, renderer e CSS. Mantém chave, sete campos
XML/defaults/labels, h1, cores e regras originais de mídia. Adaptação remove o ID
fixo e usa rótulo literal escapado; acrescenta modificador sem imagem e estilos
restritos ao Hero. Unknown JSON/valores inválidos salvos não são regravados pelo
renderer. A primeira palavra **válida** é estática; não foi implementada rotação.
[Contrato detalhado](ADAPTACAO-HERO-SEGURA.md).

MIT original/GPL completa das alterações preservados integralmente. Proveniência
local limita-se ao grafo Hero/helper/CSS e commit de origem, sem certificar direitos
globais do vendor. Finalizador exige cinco runtime, XML canônico completo e
inventário/avisos: **11 payloads / 13 arquivos por revisão**. O processo original
gera os módulos internamente em snapshot confiável, mas outros runtime não são
distribuídos nem adotados. Não é sandbox para checkout/toolchain arbitrários.

| Revisão de ensaio | SHA-256 do inventário |
| --- | --- |
| 0.3.0 | `592c10026ff5282fa53d67c91fafb8a501b774873fbe688604935e69667d2658` |
| 0.3.1 | `fd1b97dbf5fb28231ee2f32200ae224e63af18f76c7aa53e435f3c599a71ca37` |

**Teste no site:** apenas os dois pacotes de ensaio foram carregados em pastas
novas imutáveis, `overwrite=false`; 26 arquivos relidos por hash/bytes/MIME.
Não se alterou CanvasContent1, release ativa, catálogo ou aprovação de raiz no
host. Descoberta/read-only verificou Hero 0.3.1 e revisão 0.3.0 retida. Composição
temporária em memória de 8+2 raízes manteve as oito antigas; isso não ocupou vagas
na configuração publicada. Roots de ensaio não são módulos instalados.

Import/render real e CSS externo em root temporário passaram nas duas versões,
com texto longo em **180/320/768/900 px**. Sem imagem: uma coluna, mídia oculta,
scroll igual à largura e nenhum ID duplicado. Texto/alt escapados, objetos
malformados/accessors sem getters, imagem/ação inseguras omitidas sem solicitar
URLs recusadas. Imagem já publicada da amostra foi somente lida para o ensaio;
nenhuma mídia nova carregada, copiada ou incorporada ao pacote Hero.

**Análise:** com imagem válida, duas colunas no viewport largo preservadas, sem
overflow nos quatro contêineres testados. Ensaio de viewport em
**320/700/701/900/1366 px** confirmou mídia empilhada em ≤700 e lado a lado acima
de 700, conforme regra original. Sem imagem usa uma coluna em qualquer largura.
Rótulo acessível foi aceito com título/palavra úteis; ambos explicitamente vazios
ainda produzem nome vazio. Não se declarou nova constraint do schema nem aceitação
de conteúdo vazio como nome significativo. Chrome/showTitle/headingTag do core
não foram implementados nesse renderer; h1 original permanece.

**Validação de formulário:** painel real em root temporário usando os componentes
da 0.15.0 e **repositórios de memória**, com as leituras auxiliares do site
bloqueadas para writes. Os sete campos renderizados e editados com FIORI-AUTO;
Enter salvou uma mudança apenas em memória, preservou `future` e rejeitou ETag
anterior. Renderer real consumiu os parâmetros relidos. **Uma gravação de memória,
zero gravações remotas**, sem cadastro/instância de Hero nas listas. Não é aceite
de persistência SharePoint ou criação inicial do Hero. App/root descartados e
conteúdo do painel original mantido.

**Teclado:** Tab real percorreu as duas ações; Enter gerou clique `isTrusted`
com destino interno correto. Navegação foi cancelada explicitamente pela fixture
para evitar interferir no painel original. O foco observou outline nativo `auto`
de 1 px, não um novo foco personalizado implementado. Leitor de tela, zoom real,
contrastes integrais, forced-colors e múltiplos h1 na composição definitiva seguem
pendentes; isso não é acessibilidade integral.

## Iteração 4 — revisão → correção do finalizador → validação

Revisão independente encontrou uma lacuna de bytes: Buffers com propriedades
próprias `length`/`valueOf` podiam executar getters antes da validação. Arquivos
normais lidos do disco não afetados. Correção local exige Buffer real/prototype
exato e descritores de índices próprios; tamanho/cópia usam intrínsecos capturados,
sem `Buffer.from(input)`. Negativos de evidências/arquivos staged executaram zero
getters. Não é sandbox para Proxies ou globals previamente modificados.

**17/17 portáveis, 18/18 incluindo audit das duas versões** passaram depois do
hardening; reprodução de todos os bytes finais manteve os pins acima, sem mudar
ou republicar pacote imutável. Revisão independente confirmou a correção com 23
contraprovas e zero getters. A correção é de tooling local, não de runtime.

Primeira regressão completa coincidiu com edição do builder pelo agente e falhou
na comparação byte-a-byte do contributor. Não contada como aprovação. Com fontes
estáveis, **89 suítes passaram, zero skips/falhas**; sintaxe de 270 JS aprovada.
Child standalone: 77 locais/11 skips esperados; novas dependências do runner e
allowlist contributor declaradas explicitamente, sem esconder falhas instaladas.

## Documentação, preservação e próximo desenvolvimento

Releitura independente final comparou **todos os 48 registros/ETags**, sem
diferenças. Páginas permanecem publicadas/sem checkout na 0.15.0 e oito raízes
continuam aprovadas. Editor TinyMCE/abas/cleanup, quatro plugins, imagens/menu e
Sample Data bloqueado mantidos; 166/115 recursos admin/público na janela observada
sem HTTP >=400 de assets. **Nenhum registro ou raiz de Hero adicionados.**
Agregação verificou hashes de 24 recibos aprovados. Audit posterior ao hardening
reproduziu os dois pacotes finais sem alterar arquivos ou inventários publicados.

Pacotes/avisos, snapshots brutos/ETags, imagens de referência e ensaios temporários
ficam em `tmp/hero-cycle/` / `tmp/hero-adapt-agent-*`, ignorados. Não transportar
dados/cookies/tokens para documentação pública. Código original CAMAP2 intacto.

**Próximo ciclo isolado: Home**, sem consumir as vagas de roots enquanto o grupo
real não puder ser revisto e congelado dentro dos limites. Hero segue **não
adotado**; ensaio não substitui cadastro, enable/disable, revisões de registro ou
recuperação real no destino definitivo. Sete módulos ainda pendentes de adoção.
XML plugins/templates e migração assistida seguem frentes separadas. Principal
preservada sem merge; distribuição pública/aceites globais não concluídos.
