# Apresentação pública independente

## Estado publicado e fonte local — 04/11/2026

O template padrão público (`src/media/templates/site/cassiopeia/css/template.css`, chave `cassiopeia`)
foi neutralizado e publicado no público **0.2.11** para uma apresentação inspirada no Cassiopeia do
Joomla, sem paleta, fonte ou tokens corporativos obrigatórios. É uma
implementação JavaScript/CSS própria, não uma distribuição oficial do Joomla
nem uma promessa de equivalência visual pixel a pixel.

**Baseline atual informado pelo coordenador:** público **0.2.11** e administração
**0.2.10**, fonte `23f4696`. A 0.2.8 publicou a correção de apresentação de imagens,
preservada na 0.2.11 com o mesmo hash do sanitizador. O usuário informou teste positivo da
imagem (“ok você está certo acabei testar”), distinto da fixture sintética e do
artigo real sem imagens observado pelo agente. Não houve nova verificação
remota nesta reconciliação documental nem aceite visual/assistivo integral.
Admin 0.2.9 foi brevemente ativada e revertida **somente no src administrativo**
para 0.2.7 após falha do contrato JSON na rota real; reload confirmou montagem
única/rota funcional. Público 0.2.8 e seu canvas/ETag ficaram iguais, sem edição
de dados **naquele rollback histórico**. **0.2.10 foi posteriormente publicada**,
fonte/push `23f4696`, após revisão independente dos contratos JSON e prévia com
catálogo real. Uma montagem, rotas e TinyMCE real/três abas/cleanup passaram sete
larguras após reload; dados/ETags e público 0.2.8 preservados. Esse incremento
administrativo não adota Cassiopeia nem é aceite visual integral. Ver
[incidente administrativo](CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios).

**Cassiopeia neutro efetivo no host:** publicação 0.2.11 substituiu somente o
`src` do script público 0.2.8 → 0.2.11, preservando admin 0.2.10/canvas/ETag.
Nove arquivos novos (sete JS/CSS/manifesto), **248 dependências históricas /
257 assets totais** verificados por bytes/SHA-256/MIME, inclusive CSS. São seis
módulos substituídos no grafo real 0.2.8, não atualização integral do runtime.
Sanitizador 0.2.8 com hash igual, quatro CSS CAMAP opcionais e recursos absolutos
0.2.1/`import.meta` ficaram iguais. Configuração salva mantém precedência sobre
o fallback `camap` → `cassiopeia`, sem gravação editorial ou de configuração.

**Pré-baseline efetiva corrigida:** a leitura imediatamente anterior encontrou
0.2.8 já montando Cassiopeia com o CSS corporativo antigo. A origem da alteração
externa de configuração é desconhecida; não atribuir a escolha salva à 0.2.11
nem tratar CAMAP histórico como seleção ainda efetiva. Após reload, o novo script
0.2.11 carregou o CSS neutro, com cabeçalho/computed styles conferidos. Ver
[contrato público 6.6](CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211).

Este documento descreve o CSS atual e a publicação informada. As descrições de cores/fonte em
[CASSIOPEIA.md](CASSIOPEIA.md) ainda podem refletir a rodada corporativa anterior;
README/readiness agora distinguem estado atual e histórico. CAMAP continua
opcional. A neutralização selecionada `51a1b2a` foi commitada/enviada; o
coordenador informa **3 → 0 somente nas fontes selecionadas** (editor e CAMAP).
O core histórico conserva três candidatos em 48 arquivos. O **novo core 0.3.1**
foi auditado: **50 arquivos / 496.268 bytes / zero candidatos**, hashes declarados
verificados. Isso fecha somente o gate técnico do manifest, não direitos,
privacidade/histórico ou aprovação da distribuição; detalhes em
[DISTRIBUTION-AUDIT.md](DISTRIBUTION-AUDIT.md).

## Decisões visuais

| Token/uso | `standard` (inclui alias `default`) | `alternative` |
| --- | --- | --- |
| Cor primária | `hsl(220, 67%, 20%)` | `hsl(351, 54%, 37%)` |
| Links | `hsl(220, 67%, 40%)` | `hsl(207, 49%, 37%)` |
| Hover | `hsl(242, 30%, 36%)` | `hsl(351, 33%, 44%)` |
| Cabeçalho/rodapé | Gradiente primária → hover, texto branco | Mesmo contrato |
| Corpo/secundário | `#22262a` / `#495057` | Mesmo contrato |
| Borda estrutural/cabeçalho de módulo | `#dee2e6` / `#f5f5f5` | Mesmo contrato |
| Campo vazio | Contorno `#6d757e` sobre branco | Mesmo contrato |

As três cores de cada esquema e o gradiente a 135° foram conferidos na fonte
local do Joomla. O corpo permanece branco, os módulos têm superfícies neutras
e os erros usam vermelho semântico com fundo claro; foram removidas as faixas
verde/amarelo institucionais. Tags e página ativa usam primária com texto
branco. `mark` e skip link mantêm texto preto sobre `#fbeea8`.

A fonte padrão usa a pilha de sistema; `.font-roboto` prefere Roboto instalado,
com fallback para a mesma pilha. Não há download, `@import`, fonte embarcada,
CDN ou novos ativos Joomla. Todos os seletores continuam escopados em
`.cassiopeia-template`, inclusive quando o host carrega esse CSS junto ao CAMAP.

As adaptações deliberadas não tentam copiar integralmente o original:

- raízes estruturais e cabeçalhos de módulos permanecem retos; apenas controles
  internos, tags e paginação usam raio de `.25rem`;
- contornos dos campos vazios atendem contraste funcional de 3:1 no branco,
  em vez de reutilizar a borda estrutural clara;
- foco branco acompanha cabeçalho/rodapé e controles escuros; campos brancos
  no cabeçalho têm foco colorido interno, e dropdowns brancos conservam seu
  foco colorido próprio;
- menu ativo mantém sublinhado sólido; retorno ao topo continua descoberto
  por teclado, sem ocultá-lo por opacidade;
- `backTop: true` e a marca textual padrão continuam como antes, sem importar
  logo, ícones ou fontes do Joomla.

## Contratos preservados

Na frente visual original, nenhum HTML ou JavaScript de produção foi editado.
Os contratos funcionais preservados são:

- as 15 posições de módulos, região `component`, aliases `content`/`sidebar`,
  regiões condicionais e configuração do template padrão;
- classes `colors-standard`/`colors-alternative`, `font-roboto`,
  `wrapper-static`/`wrapper-fluid` e laterais condicionais;
- grade de quatro trilhas, modo fluido `1fr`, reflow e breakpoints existentes;
- menu sem JS acessível, estado `.show`/`.mm-show`, Enter/Escape, foco no
  redimensionamento e limpeza de listeners;
- skip link, destino com foco visível, retorno ao topo sem mudança de rota,
  movimento reduzido, impressão e cores forçadas;
- conteúdo sanitizado e margens inline de imagem numéricas entre 0 e 200 px;
  a correção posterior pública **0.2.8** também preserva `float` somente de
  imagem e largura em pixels limitada. As regras mantêm largura/altura
  responsivas sem sobrepor margens com `!important` ou liberar CSS arbitrário;
- parsing, ETags, upload/sync do editor e dados salvos, fora do CSS.

**Consistência concluída localmente:** o coordenador ajustou posteriormente os
rótulos de `TEMPLATE_PARAM_DEFINITIONS` em `src/templates/cassiopeia/index.js` para
Cassiopeia azul/bordô e fontes de sistema/Roboto instalado. Valores persistidos,
defaults, parsing, classes e comportamento permanecem iguais. Essa fonte integra
o incremento público 0.2.11; não alterou registros salvos nem o admin 0.2.10.

## Verificação offline

As verificações públicas estão em `tests/static-ui.test.js` e
`tests/cassiopeia-template.test.js`. Elas conferem tokens reais, contraste de
texto/foco/contornos, amostras intermediárias do gradiente sRGB, escopo, ausência
de carregamento externo, cantos estruturais retos, contratos de grade/menu/foco
e ausência de sobreposição das margens inline. As verificações administrativas
preexistentes de `static-ui.test.js` foram preservadas.

Na raiz MINIJOOMLA:

```powershell
npm test
```

As suítes proporcionais de Cassiopeia, UI estática, margens de imagem, CAMAP e
menu em árvore passaram localmente. São testes Node/estáticos, não inspeção
visual ou aceite de produção. A frente visual original não usou navegador,
tenant, rede, publicação, commit ou push; isso não descreve os commits e
validações posteriores informados pelo coordenador.

**Verificação posterior pelo coordenador:** demo e fixtures nativas em
320/768/1366/1920px passaram paleta/fonte, cabeçalho, foco skip preservando hash,
menu móvel/Escape, laterais fluidas e margens12/16px. CAMAP opcional confirmou
tokens intactos **naquela rodada anterior à neutralização selecionada**, sem
vazamento Cassiopeia. Sem publicação no tenant;
evidências ficam privadas em tmp. Isso não é comparação visual integral.

**Cobertura standalone atual (`bc64256`/`343bb58`, enviados em `23f4696`):**
sete grupos Node isolados passaram executando os módulos dos exemplos sem
transformação, incluindo template/CSS. **CAMAP preview corrigido**, sem `LIMIT`
ou warnings tolerados; defaults/estilos próprios preservam dados/ETags salvos.
Sem irmão, oito integrações são omitidas explicitamente. Use
`npm run test:standalone-examples` e [LOCAL-DEMO.md](LOCAL-DEMO.md). Não há DOM
nativo, TinyMCE real nem aceite visual nesse comando.

**Regressão final informada:** npm **43 suítes / zero skips/falhas**, sintaxe
**136 JS**, incluindo compatibilidade/avisos/conversão local. A conversão não foi
publicada e não altera este runtime público. FIORI-AUTO local passou
sete larguras após restauração JSON, escopo administrativo sintético, não aceite
do template público. A revisão independente final e a prévia/catálogo real e
reload administrativo 0.2.10 também passaram sete larguras; não aprovaram o
Cassiopeia público. A captura privada não pôde ser interpretada pelo modelo;
nenhuma análise visual integral de screenshot é alegada.

**Prévia pública 0.2.11 e reload, conforme coordenador:** composições somente
leitura com catálogo real confirmaram o CSS neutro. Sete larguras passaram 15
posições/aliases legados, imagem sintética float/180px/margem20px, contraprovas de
segurança, lifecycle e preservação DOM/hash. Dois checks de menu com Enter/Escape
nativos confiáveis passaram. Após reload, `effective.py` confirmou sete larguras,
uma montagem/versão 0.2.11, Cassiopeia/CSS neutro carregado/cabeçalho computado,
navegação e artigo real sem alerta. Essa observação real é distinta da fixture
de imagens/posições e não comprova todas as combinações de conteúdo. ETags das
duas páginas ficaram iguais durante checks; admin 0.2.10 preservado, sem save
editorial/configuração/criação de módulo/upload de mídia.

**Rollback preparado, não executado:** reler canvas/ETag atuais e usar MERGE
específico/Publish para restaurar somente `src` público 0.2.11 → 0.2.8, preservando
admin/outros webparts. A cópia anterior do runtime retoma seu CSS; não sobrescrever
assets ou trocar fontes/CSS administrativos. Revalidar montagem/rotas/grafo/ETags
e condições de autorização antes de qualquer reversão; nenhuma operação remota
foi executada nesta reconciliação documental.

## Limites e próximo aceite

**Conferência histórica**, somente leitura após o incremento administrativo 0.2.7
e antes da correção de imagens: o bootstrap público então era 0.2.1 e declarava
fallback `camap`; a configuração
lida não forneceu `templateKey` nem estilos salvos que o substituíssem. Canvas
e ETag públicos permaneceram iguais. Isso confirma que neutralizar apenas o
CSS Cassiopeia não troca a seleção efetiva. Não houve montagem/aceite visual
do público nessa conferência, nem escrita de configuração ou publicação pública.
Essa conclusão se aplica àquela leitura, não à seleção efetiva anterior à 0.2.11.

**Estado posterior informado:** a publicação de imagens 0.2.8 superou a versão
daquela conferência; a nova pré-baseline real já era Cassiopeia com CSS antigo.
0.2.11 comprovou CSS neutro no host sem salvar configuração. A precedência salva
e a mudança externa de origem desconhecida devem continuar explícitas.

**Aceites ainda abertos, mesmo após publicação:** zoom real 200%/400% não foi
estabelecido nas tentativas: `Control+Add` foi rejeitado e `Control+Equal` manteve
razão DPR 1. Não houve aceite de zoom, mas isso não prova indisponibilidade.
`forced-colors`/`reduced-motion` reais não foram conferidos; leitor de tela não
foi investigado, sem alegar indisponibilidade. CSS/fixtures de mídia não são
aceite de mídia real. Permanece necessária revisão visual integral de
contêineres estreitos, textos longos,
menus de três níveis, Tab/Shift+Tab/Enter/Escape, foco no resize, sticky sem
encobrir conteúdo, mídias reais de movimento reduzido/cores forçadas e leitor
de tela. Usar FIORI-AUTO próprio para as verificações de navegador; sete larguras,
CSS computado e menu nativo aprovados não fecham todo esse escopo.

Logotipos salvos podem ter sido desenhados para fundo branco e precisam ser
revistos sobre o cabeçalho escuro. Conteúdo personalizado, margens grandes e
CSS do host também podem afetar contraste/reflow; os passes estáticos não
certificam essas combinações.

Este avanço não resolve os bloqueios de distribuição descritos em
[OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md): dados/histórico,
proveniência/licenças de terceiros e aceite visual integral seguem separados.
A revisão dos **243 temporários rastreados** e do histórico/raiz/remoto do
agregador não é encerrada pelo core de 50 arquivos ou pela publicação no host.
A publicação informada não autoriza divulgar o agregador/histórico nem novas
operações remotas. Suporte JSON genérico administrativo não implementa UI CAMAP
`bandTones` ou conversão assistida de escopo legado.
