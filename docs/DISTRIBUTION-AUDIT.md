# Auditoria offline da distribuição selecionada

`scripts/audit-distribution.js` lê somente os **arquivos declarados** de um
manifest de staging `core`, dentro de `MINIJOOMLA/tmp/`. Não empacota, modifica,
redige, publica nem aprova dados. Não lê fontes fora do staging, projetos irmãos,
índice/histórico Git ou rede. Importar o módulo não dispara a auditoria.

## Estado reconciliado — 04/11/2026

Esta atualização é documental, a partir do agregado local e do coordenador;
não executou o auditor novamente nem leu fontes em alteração. Os resultados
das amostras históricas abaixo são preservados sem mudar suas contagens;
a tabela também distingue resultados de fonte/testes posteriores informados.

| Frente | Resultado conhecido | Limite atual |
| --- | --- | --- |
| Core integrado atual | **0.3.1 / 50 arquivos / 496.268 bytes / zero candidatos**, hashes verificados; CLI 0 | Gate manifest-only; aprovação pública/direitos/privacidade continuam **false**. Core 0.3.0 anterior preservado |
| Amostra core posterior histórica | **48 arquivos / 477.051 bytes / 3 candidatos em 3 arquivos**, hashes verificados, saída 1 | Resultado daquela amostra preservado; não substituir contagens antigas pelo novo core |
| Neutralização selecionada | `51a1b2a` commitado/enviado; coordenador informa **3 → 0 somente nas fontes selecionadas** de editor/CAMAP | Não altera a amostra histórica nem certifica seleção completa, privacidade ou histórico |
| Índice no fechamento | **436 arquivos rastreados / 243 em tmp / 193 fora de tmp** | Contagem após conversão, distinta do manifest; índices 432/189, 429/186, 425/182 e inventário inicial de 400 históricos. Sem auditoria de histórico/remoto |
| Integração SPMIDDLE | Stage atual preserva MIT original integral/copyright/disclaimer/hashes nos targets que incluem suas fontes | Omissão histórica superada; não certifica proveniência ou ausência de terceiros |
| Regressão/host | **43 suítes passaram, zero skips/falhas / sintaxe de 136 JS** após conversão assistida; DOM local sete larguras | Novo incremento local; host 0.2.10/0.2.11 e editor real testados antes dele. Não ampliado para aceite no tenant, escrita/upload ou visual integral |
| Distribuição independente | `core` seleciona fontes/licenças sem runtime TinyMCE/SPMIDDLE; `bc64256`/`343bb58` enviados em main `23f4696`, sete grupos Node isolados passaram sem `LIMIT`/warnings tolerados | Dados/ETags preservados; sem irmão, oito integrações omitidas. [LOCAL-DEMO.md](LOCAL-DEMO.md) não equivale a snapshot contributor completo, TinyMCE real ou DOM nativo |
| Publicação pública | **0.2.11**, fonte `23f4696`: 9 novos arquivos/248 dependências históricas/257 assets, bytes/SHA-256/MIME verificados; CSS neutro carregado/computado | Substituição de seis módulos do grafo real 0.2.8, não atualização integral nem novo audit core; admin 0.2.10/canvas/ETag preservados. Zoom/mídias/leitor e direitos/privacidade não aceitos |

O aviso original TinyMCE foi preservado posteriormente **só na fonte/staging
local**, sem alterar os 32 arquivos vendor anteriores ou releases do host.
`all` exige/copia/hasha `notices.txt`; `site`/`core` permanecem sem TinyMCE.
Esse reparo não fornece proveniência, textos completos de licenças ou fonte/build
GPL correspondente; ver
[avisos](THIRD-PARTY-NOTICES.md#subsequent-local-notice-preservation--2026-11-04).

**Estado do host, conforme coordenador:** público **0.2.11** e administração
**0.2.10 publicada/recarregada**. A ativação breve histórica 0.2.9 (15 arquivos/134 assets
verificados) falhou na rota real `#/moduleInstances` por contrato `json` ausente
da fonte local, exigido pelo catálogo histórico da base 0.2.5. Somente o src
administrativo foi restaurado, com canvas/ETag recém-lidos, MERGE/Publish e reload
confirmando montagem única/rota funcional; público/canvas/ETag e dados ficaram
preservados. **Posteriormente, 0.2.10 foi publicada**, fonte/main push `23f4696`,
com JSON/compatibilidade restaurados e revisão independente final aprovada.
15 arquivos novos (14 JS/manifesto), 119 dependências/134 assets totais verificados
por bytes/SHA-256/MIME; CSS 0.2.5 com hash idêntico, editor 0.2.5/agendamentos
0.2.6/descoberta 0.2.7 preservados. Prévia com catálogo real (11 registros de
módulos/oito tipos nativos com sobreposições), checks sintéticos e reload/rotas/
TinyMCE real passaram sete larguras. ETags de artigos/páginas e público 0.2.8
preservados, sem edição de dados/criação de módulo/upload. 0.2.9 permanece
imutável/inativa; ver
[contrato 6.5](CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios).

**Publicação posterior 0.2.11:** nove novos arquivos (sete JS/CSS/manifesto),
248 dependências históricas/257 assets totais verificados por bytes/SHA-256/MIME,
inclusive CSS. Fonte `23f4696`, trocando só `src` público 0.2.8 → 0.2.11 e seis
módulos de seu grafo real, não atualização integral do runtime. Sanitizador
0.2.8 com hash igual, quatro CSS CAMAP opcionais e recursos absolutos 0.2.1/
`import.meta` preservados. Configuração salva mantém precedência sobre fallback
`camap` → `cassiopeia`, sem gravação; pré-baseline 0.2.8 já montava Cassiopeia com
CSS corporativo antigo, origem da mudança externa de configuração desconhecida.
Prévia/reload em sete larguras passaram composição/catálogo reais, CSS neutro/
cabeçalho computados, uma montagem, navegação/artigo real sem alerta, posições/
aliases/imagens/segurança/lifecycle sintéticos e Enter/Escape nativos do menu.
Admin 0.2.10/canvas/ETag e ETags de ambas as páginas durante checks preservados;
sem save editorial/configuração/criação de módulo/upload. Rollback preparado
restaura só `src` 0.2.8 com canvas/ETag atuais/MERGE específico, preservando admin/
outros webparts e CSS do runtime anterior; não sobrescreve assets nem foi executado.
Zoom 200/400% não estabelecido nas tentativas; mídias reais não conferidas/leitor
não investigado, sem declaração de indisponibilidade ou aceite. Ver
[contrato público 6.6](CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211).
Publicação no host e auditoria da distribuição são evidências distintas.

### Resultado técnico atual — core local 0.3.1

Continuidade local de atribuições legadas acrescentou um módulo próprio ao
grafo administrativo: **50 arquivos / 496.268 bytes**, todos os hashes do novo
manifest conferidos, zero candidatos e CLI 0. Saída nova sob `tmp`, sem modificar
o estágio 0.3.0 ou assets do host. Assinaturas/escopo manifest-only iguais;
aprovação pública, revisão de direitos e certificação de privacidade false.
Stage all 112/site 55/core 50 passou; não se converte em pacote CMS standalone.
Ver [contrato 6.7](CONTRACTS-MINIJOOMLA.md#67-conversão-assistida-de-atribuições-legadas--local).

### Resultado técnico anterior — core integrado 0.3.0

O coordenador criou `tmp/sol-core-integrated-20261104/`, target **core**, versão
numérica **0.3.0**, e executou a CLI com
`--manifest tmp/sol-core-integrated-20261104/manifest.json`. O agregado privado
`tmp/sol-core-integrated-evidence-20261104/aggregate.json` registra
`no-candidates-in-manifest`, `all-declared-file-hashes-verified`, **49 arquivos /
490.634 bytes / zero arquivos com candidatos / zero candidatos**, sem truncamento.
Essa evidência foi lida nesta reconciliação; o auditor não foi reexecutado aqui.

`publicDistributionApproved: false`, `rightsReviewed: false` e
`privacyCertified: false` são preservados. Fecha o gate técnico de candidatos/
integridade desse manifest, não revisão manual de autenticidade/dados/direitos,
proveniência, temporários/histórico ou divulgação pública. Arquivos não declarados
continuam não auditados. 0.3.0 é versão local de estágio, não versão ativa no host;
as amostras 48/3 abaixo não foram editadas. Não distribuir a pasta de evidências.

Preparar um novo staging exige versão numérica `X.Y.Z`. O agregado recusou
`0.3.0-plan-local` **antes de gravar**, sem criar destino ou substituir versão.
Não alterar estágio antigo nem ocultar achados por whitelist. `all`/`site`
mantêm requisitos de integração e não são certificados pelo auditor core.
Direitos/fonte correspondente/avisos de terceiros, privacidade da seleção e
histórico permanecem gates distintos; continuar o trabalho não concede direitos
nem autorização para expor o agregador ou limpar sua história. Consulte o
[plano atual](PLANO-CONTINUIDADE-MINIJOOMLA.md#estado-atual-autoritativo--04112026).

## Uso

Após criar um staging core pelo procedimento de [release](RELEASE-CORE.md):

```powershell
node scripts/audit-distribution.js --manifest tmp/<stage>/manifest.json
node tests/distribution-audit.test.js
```

O caminho relativo é resolvido a partir do projeto MINIJOOMLA, independentemente
do diretório atual do shell. Caminho absoluto somente é aceito dentro do `tmp`
deste projeto. O manifest precisa chamar-se `manifest.json` em uma subpasta de
`tmp`; URLs, UNC e segmentos `..` são recusados. Nenhuma opção libera outra raiz.

O módulo exporta `auditDistribution({ manifest })`. A suíte exporta
`runDistributionAuditTests()`, já integrado pelo coordenador a
`tests/run-tests.js`. Nenhuma publicação é efetuada pelo runner.

| Código de saída | Significado |
| --- | --- |
| `0` | Hashes verificados e nenhum candidato nas assinaturas aplicadas aos arquivos declarados; **não é aprovação pública**. |
| `1` | Hashes verificados, mas existem candidatos/revisões bloqueantes. |
| `2` | Uso, manifest, caminho, limite ou integridade inválidos; não produz relatório parcial de candidatos. |

## Integridade e contenção

- Aceita apenas `target: core`, `algorithm: sha256`, versão numérica `X.Y.Z`
  e lista não vazia de entradas `{ path, bytes, sha256 }`. Campos adicionais
  no manifest/entradas são recusados, não um canal para metadados privados.
- Valida **todos os nomes** antes de abrir arquivos: caminhos relativos
  portáveis, sem traversal, backslash, percent encoding, drive/ADS, aliases
  Windows ou `.git`. Duplicatas sem diferença de maiúsculas são recusadas.
- Aplica containment lexical e realpath, `lstat`/`noLinks` nos ancestrais e no
  arquivo, inclusive manifest, junctions e symlinks pendentes. Hardlinks também
  são recusados. Somente arquivos regulares são lidos.
- Verifica tamanho e SHA-256 dos bytes originais de **cada arquivo declarado**
  antes de produzir findings; relê o manifest para detectar alteração durante a
  coleta. Hashes comprovam correspondência com esse manifest, não autenticidade,
  autoria, proveniência ou ausência de dados sensíveis. Um manifest adulterado
  junto dos arquivos não ganha confiança por ter hashes coerentes.
- Limites: manifest de 2 MiB, 2.000 arquivos, 16 MiB por arquivo e 64 MiB totais
  declarados. Relatório detalha até 100 arquivos com candidatos; as contagens
  incluem todos e `omittedFindingFiles` informa o restante.

São verificações locais proporcionais ao staging, não uma sandbox contra
processos adversários alterando simultaneamente o filesystem. Use um staging
estável. Arquivos **não declarados** e diretórios inteiros não são percorridos;
o resultado não certifica a pasta `tmp` nem um ZIP que inclua arquivos extras.
Não executar o auditor sobre uma release ainda sendo gravada.

## Candidatos e relatório sem valores

As categorias podem se sobrepor; `files` conta arquivos por categoria e
`candidates` conta ocorrências das assinaturas, não segredos únicos.

| Categoria | Motivo para revisão/bloqueio |
| --- | --- |
| `corporate-host` | Famílias de domínios corporativos conhecidas, inclusive tenants reconhecíveis; não enumera todos os hosts possíveis. |
| `corporate-path` | Caminhos `/sites/` e `/teams/`, caminhos locais reconhecíveis e identificador de projeto corporativo. Podem ser exemplos genéricos. |
| `corporate-context` | Menção textual à organização; não comprova que o conteúdo seja confidencial. |
| `guid` | Padrão GUID, mesmo se a origem for uma fixture sintética. |
| `private-key` | Cabeçalho de chave privada. |
| `credential-literal` | Atribuições/propriedades de credenciais com valores literais não vazios. |
| `bearer-or-jwt` | Padrão Bearer/JWT. |
| `signed-url` | Parâmetros típicos de assinatura/token em URL. |
| `private-artifact` | Caminhos de temporários, perfis, configurações privadas ou arquivos de chaves/credenciais. |
| `outside-core-scope` | Entrada incompatível com o conjunto de caminhos/extensões do target core, incluindo integrações/terceiros. Não é verificação completa do grafo de imports. |
| `opaque-content-review` | Bytes sem UTF-8 válido ou com NUL; exigem revisão manual, sem declarar um binário limpo. |

Nenhuma fixture é automaticamente liberada, nenhum candidato é confirmado
como segredo real e não existe redaction/whitelist para esconder o problema
ou autorizar empacotamento de dados corporativos. Um candidato bloqueia esse
gate até revisão/correção apropriada da distribuição selecionada. Corrigir
uma fonte e gerar **novo staging** é diferente de esconder o achado no relatório.

O JSON informa categorias, contagens e caminhos relativos dos arquivos, **não
valores, trechos de linha, hosts encontrados, tokens ou hashes dos candidatos**.
Se o próprio nome contém uma assinatura sensível, o caminho é `null` e
`pathWithheld: true`; `manifest.files[index]` permite localizá-lo em revisão
privada. O nome da pasta de staging também não é reproduzido. Erros da biblioteca
usam códigos fixos e os erros CLI são genéricos, sem ecoar JSON inválido ou
mensagens do filesystem. Ainda assim, relatórios de achados não são artefatos
automaticamente autorizados para divulgação.

As assinaturas são deliberadamente limitadas. Não certificam dados pessoais
arbitrários, outros domínios corporativos, conteúdos codificados/compactados,
segredos montados em runtime ou direitos sobre ativos. Ausência de candidatos
permanece `no-candidates-in-manifest`, nunca “privacy clean”, “rights cleared”
ou “public release approved”. Os campos de aprovação/certificação são sempre
`false` e o relatório preserva essas pendências.

## Pendências separadas: Git e terceiros

A revisão inicial em [OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md) registrou
243 arquivos `tmp/` rastreados dentre 400 arquivos inventariados. É um resultado
histórico, não uma contagem atual desta ferramenta. `.gitignore` não remove
arquivos já rastreados nem conteúdo do histórico. O auditor **não invoca Git**,
não mistura essas contagens com o manifest e não reescreve/remove histórico.
A revisão do índice/histórico do agregador continua sendo uma frente separada
e autorizada; core selecionado não certifica o repositório atual.

A licença própria é GPL-2.0-or-later. Conforme
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md):

- `core` não inclui o runtime TinyMCE. Distribuições que o incluam continuam
  pendentes de proveniência e fonte correspondente completa/materiais de build
  por mecanismo compatível com GPL. Um link upstream não comprova cumprimento.
- `core` não copia SPMIDDLE. Se uma distribuição incluir esse código, deve
  incluir seu copyright e o texto integral da licença MIT; a dependência opcional
  do projeto irmão não é uma dependência standalone comprovada por esta auditoria.
- Inspiração Joomla/Atum/Cassiopeia não concede direitos de marcas, endosso ou
  permissão automática para copiar código/ativos.

Nenhum download de provenance/fonte, conexão externa, decisão jurídica ou
aprovação de divulgação é efetuado pelo script.

## Histórico — verificação da entrega — 04/11/2026

Testes exclusivamente sintéticos em subpastas próprias de `tmp`: sucesso sem
candidatos, candidatos/fixtures sobrepostos sem valores no JSON, nomes sensíveis,
contagens completas com truncamento, ausência de alteração dos arquivos,
arquivos não declarados fora do escopo, hashes/tamanhos adulterados, JSON/schema
inválidos, limites, path escaping/ADS/aliases, duplicatas, arquivos ausentes,
diretórios e hardlinks. CLI valida códigos de saída, resolução a partir do
projeto e import sem efeitos.

Nesta máquina Windows, **2 verificações de junction/ancestral passaram**; **3
verificações de symlink de arquivo (incluindo pendente/manifest) foram omitidas
por permissão do sistema**. A suíte anuncia contagem de skips, não simula passe.
Os casos permanecem no teste e são executados onde a criação estiver permitida.

Leitura do manifest `tmp/sol-core-next-20261104/manifest.json`, sem modificá-lo:
**48 arquivos / 475.580 bytes**, todos os hashes verificados, **9 ocorrências
candidatas em 5 arquivos**. Resultado CLI `1`, sem truncamento:

| Arquivo declarado | Categoria | Ocorrências |
| --- | --- | --- |
| `app/administrator/components/com_minijoomla/editor.js` | `corporate-path` | 1 |
| `app/templates/camap.css` | `corporate-context` | 1 |
| `app/templates/camap.js` | `corporate-path` | 1 |
| `app/templates/default.css` | `corporate-context` | 2 |
| `app/templates/default.js` | `corporate-context` | 4 |

Essa amostra refere-se apenas àquele staging existente. Não identifica segredos
reais nem certifica fontes posteriores, direitos, privacidade, Git ou publicação.
Naquele momento, o coordenador precisava repetir o gate após integrar fontes.
O resultado do novo core 0.3.0 está acima; as aprovações permanecem separadas.

Novo staging posterior `tmp/sol-core-next-20261104b/manifest.json`:
**48 arquivos / 477.051 bytes**, hashes verificados, **3 candidatos em 3 arquivos**
(editor e CAMAP). `default.css/default.js` já não apresentam candidatos nas
assinaturas aplicadas. Gate continua1; não editar um estágio para ocultar achados.
Os 243 temporários rastreados foram reconfirmados por contagem somente leitura,
fora do script manifest-only. Sem remoção nem revisão completa da história.

Na retomada, o coordenador corrigiu o staging `all`/`site` para preservar a
licença raiz SPMIDDLE MIT integral, com bytes originais e hashes no manifesto,
além dos avisos próprios MINIJOOMLA. Isso não altera os48 arquivos deste core,
seus três candidatos ou qualquer decisão de divulgação. Fonte/proveniência e
avisos internos TinyMCE continuam pendentes; detalhes nos third-party notices.

## Histórico — revisão manual selecionada após retomada — 04/11/2026

Esta revisão documental é **separada da ferramenta manifest-only**: leu os três
arquivos fonte abaixo, o pacote TinyMCE original retido localmente, licenças e
metadados selecionados de `../SPMIDDLE`, além do código do staging. Não amplia
o escopo do auditor nem converte suas pendências em passes. Caminhos temporários
são representados genericamente como `tmp/<local-stage>/` e
`tmp/<local-package>/`; valores corporativos encontrados não são transcritos.

O auditor foi repetido somente em leitura sobre o staging core posterior já
existente: **48 arquivos / 477.051 bytes**, todos os hashes declarados verificados,
**3 ocorrências em 3 arquivos**, sem truncamento, saída **1**. Comparação SHA-256
separada confirmou que cada um dos três arquivos fonte ainda coincide com seu
arquivo `app/` nesse staging e com a entrada do manifest. Isso vincula a leitura
manual à amostra, não autentica autoria, origem ou fontes futuras.

### Classificação dos três candidatos

| Fonte / arquivo no staging | Natureza observada | Conclusão delimitada e pendência |
| --- | --- | --- |
| `src/administrator/components/com_minijoomla/editor.js` / `app/administrator/components/com_minijoomla/editor.js` | `corporate-path`: exemplo abreviado de pathname no comentário sobre `relative_urls` (linhas 229–244), não um specifier de módulo. | O trecho contém segmentos omitidos e explica resolução de URL; não identifica ali um tenant real nem configura destino. `vendorBaseUrl` e `uploadImage` são injetados. Não confirma segredo, mas comentários históricos/contexto e direitos do bridge continuam sujeitos à seleção pública. Autenticação/autorização do host não foi verificada. |
| `src/templates/camap.js` / `app/templates/camap.js` | `corporate-path`: identificador de contexto corporativo dentro de `DEFAULT_SITE_NAME` (linha 25), não pathname. | É dado padrão **executável**, usado por `resolveCamapParams` quando falta título configurado e renderizado na identidade do shell/rodapé. Não é mero comentário/fixture nem dependência externa. Não comprova credencial ou registro obtido de tenant; origem, direitos e autorização de divulgação/identidade continuam pending. |
| `src/templates/camap.css` / `app/templates/camap.css` | `corporate-context`: nome de família tipográfica em `font-family` (linha 1). | É preferência real do estilo, com fallbacks; o CSS inspecionado não contém `@font-face`, `@import` ou `url()` de fonte/ativo. Não há bundle/download de fonte nesse arquivo, mas isso não concede direito de redistribuir a fonte nem aprova a identidade do tema. Referência/seleção pública e direitos continuam pending. |

A categoria `corporate-path` reúne assinaturas de naturezas distintas: o nome
de contexto em CAMAP é classificado pela mesma regra que pathnames, sem ser um
caminho de rede. O editor carrega TinyMCE via base injetada quando chamado;
essa dependência de runtime **não equivale** ao pathname de exemplo encontrado
no comentário. O target core inclui o bridge, mas não o runtime vendor nem a
composição de upload/host. Nenhum dos três achados foi confirmado como token,
GUID ou endpoint tenant real nessa leitura; isto não certifica ausência de
outros dados, URLs montadas em runtime ou segredos fora da amostra.

**Decisão daquela frente histórica:** classificação manual registrada, não liberação do
gate. Nenhum candidato foi apagado, redigido ou incluído em whitelist, e nenhum
staging foi editado/gerado para mudar o resultado. Uma decisão posterior sobre
seleção pública/neutralização deve preservar a árvore atual e, se alterar fontes
com autorização, gerar outro staging e repetir o gate; não ocultar o achado.

### Licenças, terceiros e proveniência local

A evidência detalhada está em [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md):

- **TinyMCE 7.9.1:** os **32 arquivos** vendorizados coincidem por SHA-256 com
  os arquivos do pacote extraído local e com suas entradas no `.tgz` original
  retido. A leitura do arquivo compactado foi para memória, sem extração em
  disco. `license.md` e metadados locais concordam em GPL-2.0-or-later.
  Correspondência entre cópias locais não autentica origem upstream, download,
  assinatura/integridade de registry ou autoria; essas evidências seguem pending.
- **Fonte correspondente:** o pacote retido tem bundles JS/CSS não minificados
  e definições de tipos, mas não uma árvore de fonte preferida/materiais de build
  completos verificados. A GPL v2 local, seção 3, exige avaliar fonte dos módulos,
  interfaces e scripts de compilação/instalação e cumprir o mecanismo aplicável.
  Links, nomes de versão e bundles legíveis não fecham essa obrigação.
- **Terceiros embutidos:** o `notices.txt` do pacote original lista DOMPurify
  3.2.4 modificado (MPL-2.0 OR Apache-2.0), PrismJS 1.25.0 (MIT) e prism-themes
  1.9.0 (MIT); o subset vendor **inspecionado então não incluía esse arquivo**.
  A cópia posterior de avisos aguarda resultado/revisão, sem nova inspeção de
  fonte em alteração aqui. Há avisos embutidos
  no core, codesample e duas skins. Textos integrais aplicáveis, copyrights,
  mapeamento exato do tema/versão, modificações e compatibilidade de licença
  continuam pending. Não assumir que a licença principal absorve esses avisos.
- **SPMIDDLE:** LICENSE raiz contém MIT integral e copyright próprios; o pacote
  raiz declara MIT. Sete manifests de pacotes indicam 0.1.0 sem campos individuais
  de licença/dependências e sem LICENSE/COPYING/NOTICE separados encontrados nos
  diretórios de pacotes. Isso não audita todo seu código/proveniência nem prova
  ausência de terceiros embutidos. **Diagnóstico histórico superado:** a leitura
  anterior de `stage-release.js` registrou `all`/`site` copiando fontes sem o MIT
  raiz. O stage atual preserva a licença original/avisos e hashes, com gates de
  falta/truncamento/junction. Proveniência/direitos seguem pendentes; `core`
  não inclui essas fontes.
- **Joomla:** comentários do bridge descrevem adaptação de preset/comportamento.
  Não comprovam cópia, autoria ou ausência de material reutilizado. Comparação
  de fonte/licença Joomla e direitos de marcas não foi realizada nesta seleção.

### Limites preservados daquela revisão histórica

Somente estes dois documentos foram atualizados por esta frente. Não houve
testes que criam/excluem fixtures, instalação, download, navegador, rede,
republicação administrativa, escrita em `../SPMIDDLE`, limpeza de fontes/
candidatos/artefatos, commit, push ou reescrita de histórico. A publicação
administrativa 0.2.4 não foi revalidada nem alterada. Evidências de autenticação,
proveniência externa e fonte correspondente não verificáveis permanecem
**pending**, assim como privacidade/direitos da seleção e revisão do histórico.
Não foram criados novos relatórios nem declarada uma release pública aprovada.
