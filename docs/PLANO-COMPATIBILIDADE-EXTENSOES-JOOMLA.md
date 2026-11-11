# Plano de compatibilidade de extensoes com Joomla

> Escopo ampliado em 06/11/2026 pelo responsável: outros dez módulos,
> plugins/templates XML e migração assistida incluídos no plano. Ver
> [avaliação vigente](AVALIACAO-E-ESCOPO-2026-11-06.md) e
> [contratos da evolução](CONTRATOS-EVOLUCAO-XML.md). i18n, SEO do host,
> histórico e check-in/check-out de artigos estão excluídos nesta etapa.
> O diagnóstico inicial abaixo é histórico: o perfil XML de módulos já foi
> implementado/publicado conforme registros, mas seu aceite integral é separado.
>
> **Prioridade posterior:** somente fechamento Joomla padrão; Videoteca/Forum
> e expansão externa suspensos. Primeiro consolidar trabalho validado e as
> contribuições nativas preservadas da principal. XML de plugins/templates e
> migrações permanecem evolução delimitada, não paridade PHP/ZIP/ACL.
> [Fila vigente](PLANO-CONTINUIDADE-MINIJOOMLA.md).

Data: 05/11/2026 (America/Sao_Paulo).
Estado: analise concluida e proposta de implementacao; nenhuma funcionalidade,
lista SharePoint ou publicacao foi alterada por esta analise.

## 1. Decisao recomendada

Adotar como diretriz: **preservar os conceitos, a estrutura e o fluxo Joomla
sempre que o runtime JavaScript e o armazenamento permitirem; toda diferenca
deve ser necessaria, documentada e testada.**

A primeira entrega deve permitir publicar um modulo JavaScript em
`modules/mod_exemplo/`, acompanhado de `mod_exemplo.xml`, encontra-lo em
Descobrir, instala-lo explicitamente e criar/configurar/publicar suas instancias.
Nao deve exigir que o desenvolvedor escreva um segundo manifesto JSON de
descoberta ou configure manualmente os mesmos parametros em dois lugares.

Isso e compatibilidade estrutural, declarativa e de experiencia, nao
compatibilidade binaria com extensoes PHP. Um pacote Joomla PHP nao se torna
executavel por ter sido reconhecido. Descoberta, instalacao, habilitacao da
extensao e publicacao da instancia sao operacoes distintas.

Nao implementar agora um instalador generico de ZIP, um servidor PHP, ACL,
execucao de SQL ou scripts de instalacao. O pedido desta etapa foi de analise
e plano; execucao funcional e publicacao continuam fora desta entrega.

## 2. Base efetivamente examinada

| Referencia | Estado observado |
| --- | --- |
| Worktree no inicio da analise | `web-devs-worktree02`, branch `worktree/web-devs-02`, HEAD `1965790` |
| Evolucao concorrente observada | Outra frente registrou `ae59d51` durante a analise; surgiram controllers/views de `com_config`, `com_installer` e `com_templates` em andamento |
| Alteracoes alheias | Separacao administrativa de artigos, menus, midia e descoberta; nao alteradas nem descartadas |
| Joomla local, somente leitura | `web-devs/JOOMLA`, commit `52559589cb6a02c9e2fc48270f92b3aff7b8b7a0`, branch `6.2-dev` |
| Documentacao oficial consultada | Manifestos Joomla, pagina identificada como versao 6.1 atual na consulta |
| Outra frente local/remota conhecida | Ref local `origin/feat/camap-modules-minijoomla`, snapshot `55b92695045ac51fa513334cbb7dc0fcf48756e3` |
| Publicacao documentada no projeto | Release 0.5.1; informacao lida da documentacao, nao revalidada no tenant nesta analise |

Nao houve fetch, merge, cherry-pick ou inspecao remota do SharePoint. A ref da
outra frente representa o snapshot local conhecido, nao garantia de atualidade
do GitHub. A implementacao devera reconciliar as frentes antes de alterar
arquivos compartilhados. Nao usar a branch de desenvolvimento Joomla como
promessa de suporte a toda uma versao futura.

### Evidencias locais de testes

| Comando | Resultado nesta analise |
| --- | --- |
| `MINIJOOMLA: npm test` | 58 suites aprovadas, zero skips, zero falhas |
| `MINIJOOMLA: npm run check` | Sintaxe aprovada em 204 arquivos JavaScript |
| `CAMAP2: npm test` | 92 testes aprovados e uma falha, de 93 testes |

A falha CAMAP2 e do checksum do artefato existente:
`dist/camap2-extensions/0.1.0/components/camap/com_forum/forum.css` tem
5.067 bytes no checkout e declara 4.779. A leitura normalizada para LF tem
4.779 bytes e SHA-256 igual ao declarado; `git ls-files --eol` confirmou
`i/lf w/crlf`. Portanto, este caso foi explicado por conversao de finais de
linha, nao por defeito demonstrado no render do corpmessage. Nao normalizar
arquivos publicados para esconder falha de integridade: o artefato distribuido
e os bytes declarados precisam ser identicos.

Os testes de render do corpmessage passaram. Isso nao comprova descoberta,
CSS, import de navegador, gravacao ou funcionamento no SharePoint. A baseline
foi executada sobre o estado observado antes das novas extracoes concorrentes
de discovery/config/templates; ela nao certifica esses novos arquivos. O
controller novo de `com_installer` foi inspecionado somente em leitura: continua
consumindo `discoveryService.scan()` JSON e registrando a extensao desabilitada.

## 3. Diagnostico e referencias de codigo

| Achado | Evidencia | Consequencia |
| --- | --- | --- |
| Descoberta atual le somente JSON plano | [extension-discovery-service.js](../src/libraries/minijoomla/application/extension-discovery-service.js), `scan`, `MANIFEST_SUFFIX` | `modules/mod_*/mod_*.xml` nao e consultado; renomear apenas o JS nao resolve |
| XML nativo ja existe, mas nao alimenta a descoberta | [module-manifests.js](../scripts/module-manifests.js), `generateModuleManifests` | Reaproveitar o gerador e testar sua leitura; nao criar outro dialeto independente |
| Raiz compartilhada difere da raiz da release | [host.js](../host-adapters/modern-script-editor/host.js), `fileClient`; [deploy-sharepoint.mjs](../scripts/deploy-sharepoint.mjs), `assets` e `release` | O comentario que pressupoe RELEASE_BASE no scanner nao descreve o host atual |
| SPMIDDLE nao lista subpastas nem segue paginacao nessa API | `SPMIDDLE/packages/sharepoint-files/src/files.js`, `listFiles`/`downloadFile` | A busca por diretorios Joomla exige capacidade adicional de leitura |
| CAMAP2 produz outro layout | [package-extensions.js](../../CAMAP2/tools/package-extensions.js) | O pacote atual copia `extensions/camap/mod_*`; nao gera o layout XML esperado |
| Entrypoint CAMAP2 nao e URL final de import | [corpmessage/manifest.json](../../CAMAP2/extensions/camap/mod_camap_corpmessage/manifest.json); [dynamic-modules.js](../src/libraries/minijoomla/modules/dynamic-modules.js), `DEFAULT_IMPORT` | `extensions/camap/...` e referencia de pacote, nao specifier relativo valido no navegador; resolver antes de persistir |
| Parametros externos vem do manifesto registrado | [module-catalog.js](../src/libraries/minijoomla/application/module-catalog.js), `moduleTypeCatalog` | `settings-schema.js` nao e lido automaticamente pelo painel; e necessario traduzir os campos |
| CSS CAMAP2 nao e integrado automaticamente ao runtime desta worktree | [dynamic-modules.js](../src/libraries/minijoomla/modules/dynamic-modules.js) | A declaracao `styles` no pacote nao basta para aplicar `mc.css` |
| Existe solucao parcial em outra frente | `prepare-minijoomla-modules.js` e `module-styles.js` na ref examinada | Revisar e portar o que serve; nao reimplementar nem fazer merge amplo automaticamente |
| Alteracao comum nao pode mudar a URL instalada | [admin-service.js](../src/libraries/minijoomla/application/admin-service.js), `extensions.update` | Atualizar versao exige caso de uso proprio e rollback; nao remover a guarda de identidade |
| Schema tem chaves e metadados reutilizaveis | [spmiddle-schemas.js](../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js) | Priorizar `Key`, `ManifestJson`, `DiscoveredFrom` e ETags existentes, sem nova lista por conveniencia |
| Indice unico declarado nao comprova unicidade ativa | `SPMIDDLE/packages/sharepoint-provisioning/src/provisioning.js`, `missingIndexAction`, `supported: false` | Verificar a restricao real no campo SharePoint antes de garantir instalacao concorrente sem duplicatas |

No Joomla de referencia, `ModuleAdapter::discover` procura o XML homonimo
nos diretorios de modulos. Ja `InstallerAdapter::discover_install` possui
etapas de instalacao e pode executar scripts/SQL. Apenas a primeira parte e
diretamente transponivel ao host atual. Fontes primarias:
[ModuleAdapter fixado](https://github.com/joomla/joomla-cms/blob/52559589cb6a02c9e2fc48270f92b3aff7b8b7a0/libraries/src/Installer/Adapter/ModuleAdapter.php),
[InstallerAdapter fixado](https://github.com/joomla/joomla-cms/blob/52559589cb6a02c9e2fc48270f92b3aff7b8b7a0/libraries/src/Installer/InstallerAdapter.php).

## 4. Escopo de compatibilidade

| Comportamento | Primeira entrega | Evolucao posterior / limite |
| --- | --- | --- |
| `modules/mod_x/mod_x.xml` | Sim, modulo de site com entrypoint JS declarado | Modulo administrativo exige composicao e lifecycle proprios |
| Metadados XML e `<config>` | Subconjunto explicito, campos suportados e diagnostico dos demais | Campos customizados PHP e formularios complexos nao serao simulados |
| Descobrir, listar e instalar | Sim, arquivos ja publicados e registro desabilitado | Habilitar continua separado; diferenca de seguranca assumida |
| Instancias e posicoes | Reusar o contrato atual, sem renomear dados | Preservar aliases de posicao e regras de atribuicao |
| CSS e dependencias | Artefatos declarados/validados em pacote aprovado | XML/configuracao nao se torna autorizacao para carregar qualquer recurso |
| Atualizar versao | Operacao explicita, mesma identidade e ETag | Sem scripts de migracao arbitrarios |
| Desinstalar | Guarda de dependencias e remocao explicita do registro | Nao apagar instancias/arquivos automaticamente como efeito colateral |
| Plugins e templates XML | Segunda onda, apos modulo piloto aceito | Grupos/eventos, templateDetails.xml e assets possuem contratos proprios |
| Componentes externos | Inventariar e reportar como nao suportados no perfil inicial | Roteamento, formularios e persistencia precisam de frente especifica |
| Idiomas, libraries, files e packages | Identificar tipo nao suportado quando observado | Nao afirmar instalacao generica desses tipos |
| PHP, SQL e scriptfile | Detectar e bloquear a instalacao executavel | Exigiriam outra plataforma; fora deste plano |
| JSON legado | Continua funcionando | Sem remocao ou migracao automatica nesta melhoria |

O XML do Joomla continua sendo referencia para nomes e semantica. O perfil
JavaScript do MiniJoomla deve ser identificado claramente: o gerador nativo
ja declara um `<filename module="mod_x">mod_x.js</filename>`. Isso e uma
adaptacao, nao prova de que o pacote executa no Joomla PHP.
[Documentacao oficial dos manifestos](https://manual.joomla.org/docs/building-extensions/install-update/installation/manifest/).

## 5. Arquitetura proposta

### 5.1 Fluxo e fronteiras

```text
raizes aprovadas pelo host
  -> porta de leitura de arquivos/pastas
  -> leitura XML ou JSON legado (sem import de JS)
  -> descritor normalizado + diagnosticos + identidade + fingerprint
  -> tela Descobrir
  -> servico explicito de instalacao / atualizacao
  -> repositorios atuais com ETag e unicidade
  -> habilitacao
  -> instancias de modulo e runtime existente
```

MINIJOOMLA conhece contratos de descoberta e dominio; SPMIDDLE continua dono
do transporte SharePoint. CAMAP2 permanece projeto externo: nenhuma lista de
modulos CAMAP ou caminho corporativo deve ser embutido no core generico.

Reusar `scan()` e `scanUnregistered()` sem mudar abruptamente sua forma de
retorno. Um relatorio adicional, por exemplo `scanReport()`, pode informar
`entries`, `complete`, raizes e falhas. Ele deve usar o mesmo motor, nao
duplicar a implementacao. A descoberta JSON atual conserva a preservacao do
manifesto bruto exigida pelos testes.

### 5.2 Raizes: separar armazenamento de release e descoberta legada

Receber por injecao do host uma lista finita de raizes de instalacao confiaveis.
Dentro de cada raiz, aplicar os caminhos Joomla, sem varrer toda a biblioteca.
Configurar separadamente:

- raiz dos JSON legados: a atual `SiteAssets/minijoomla`, com `extensions/`;
- raiz da release do core: somente leitura e inventario de nativos;
- raiz(s) versionada(s) dos pacotes externos: contem `modules/`, `media/` e
  dependencias declaradas, sem obrigar uma nova release do core por modulo.

Contrato host-adapter proposto: cada raiz possui `id`, `baseUrl`
server-relative canonica, perfil e tipos/clientes permitidos. O host cria um
cliente SPMIDDLE por raiz com `libraryPath: root.baseUrl`; a porta do scanner
recebe `rootId` e caminhos relativos, nunca uma URL arbitraria fornecida pela
UI. Clientes legacy, XML e inventario nativo nao compartilham implicitamente
o mesmo `libraryPath`. Fixar a revisao dessa configuracao durante o scan/install.

O contrato e relativo a uma raiz Joomla-like, nao a um caminho SharePoint
unico hardcoded. O scanner nao deve adivinhar a release ativa nem procurar
recursivamente em `releases/` para selecionar a maior versao. A configuracao
explicita decide o que esta ativo. Na implantacao, o empacotador/deploy deve
gerar a configuracao de raizes e assets, sem segundo manifesto manual por modulo.

Copiar arquivos dentro de uma release ja publicada continua proibido. O fluxo
familiar sera: preparar/publicar um pacote novo com arvore Joomla, configurar
sua raiz aprovada e usar Descobrir/Instalar. No host SharePoint, a aprovacao de
codigo e de sua raiz e uma diferenca necessaria em relacao a um servidor PHP
com filesystem mutavel. Exibir as raizes efetivamente consultadas; se um caminho
informado estiver fora delas, rejeita-lo no preflight. O scanner nao pode
afirmar detectar pastas que nao enumera nem fazer busca global como fallback.

### 5.3 Identidade e reconciliacao

Usar a identidade logica `(tipo, cliente, grupo, elemento)`; para modulo de
site, grupo vazio e elemento `mod_x`. Nome do XML, pasta e elemento declarado
devem ser coerentes. Resolver `<element>`, atributo `module` e nome conforme
as regras do perfil, sem escolher silenciosamente entre valores conflitantes.

Preservar `Key`, IDs e referencias existentes. Em particular,
`camap.mod_camap_corpmessage` nao deve virar outra chave ao mudar de pasta.
Manter um mapa explicito de aliases, fornecido pelo pacote/adaptacao CAMAP2,
e nao regras especificas CAMAP no core. Para novas instalacoes, definir chave
deterministica derivada da identidade e verificar unicidade no servidor.

Modulos nativos devem ser reconhecidos pelo catalogo e seus aliases; por
exemplo, `mod_custom` nao pode duplicar a chave persistida `custom-html`.
Dois candidatos da mesma identidade em raizes diferentes exigem selecao
explicita de versao ou erro de conflito, nunca escolha automatica pelo nome.

### 5.4 Parser XML e parametros

Implementar um parser estrutural de XML; nunca extrair XML com regex.
Recomendacao para manter o runtime sem dependencia adicional: injetar um
parser DOM, usar `DOMParser` com `application/xml` no browser e um parser XML
mantido para os testes Node. A fase inicial deve comprovar paridade de erros
e de arvore entre os dois; se isso falhar, selecionar uma unica biblioteca
compativel com ambos. Nao criar um parser artesanal para evitar essa dependencia.

O perfil inicial deve tratar UTF-8, BOM, comentarios, namespaces, CDATA e
entidades predefinidas, rejeitando documentos malformados, DTD, entidades
externas e instrucoes de processamento nao suportadas. Aplicar limites de
bytes, profundidade e quantidade de campos antes de produzir dados de dominio.

Ler tipo, cliente, identidade, versao, descricao, arquivos, media e `<config>`.
Mapear `text`, `textarea`, `number`, `list` e campos booleanos suportados para
as definicoes de [declared-params.js](../src/libraries/minijoomla/application/declared-params.js),
preservando limites, opcoes, ordem e defaults. Nao interpretar todo `radio`
como booleano; opcoes nao booleanas devem continuar enumeradas. Nao converter
todo `textarea` em JSON. Para `array/object` usados no CAMAP2, definir uma
extensao declarativa de tipo/namespace identificada como MiniJoomla, com
coercao explicita e roundtrip testado. O gerador nativo atual perde essa
distincao ao converter `json` para `textarea`; nao promover essa conversao a
fonte de verdade de configuracoes.

Aceitar apenas campos realmente suportados. Um campo customizado ou requisito
de PHP essencial torna o candidato nao instalavel com motivo especifico;
metadados desconhecidos inertes podem ser preservados com aviso. Nao omitir
campos silenciosamente e registrar uma extensao incompleta. Chaves reservadas,
defaults invalidos e nomes duplicados continuam bloqueados. Textos de idioma
sem resolucao precisam de fallback visivel; i18n Joomla completo fica separado.

### 5.5 Caminhos, assets e seguranca

- Resolver referencias XML com a URL do manifesto e as regras de layout
  instalado; persistir URLs server-relative canonicas. Nao passar referencias
  de pacote como `extensions/camap/...` diretamente ao `import()`.
- Distinguir pasta fonte do pacote (`files folder`/`media folder`) do destino
  instalado. `Discover` inspeciona o destino; nao deve tentar reinstalar/copiar
  arquivos a partir de caminhos de desenvolvimento.
- Validar origem, site e raiz aprovada depois da normalizacao/decodificacao;
  rejeitar traversal simples/codificado, esquemas, credenciais, backslashes,
  redirecionamentos para fora da origem e paths reservados.
- Validar todo o grafo de imports estaticos e assets do pacote no build.
  Dependencias compartilhadas podem estar em `libraries/` dentro do mesmo
  pacote aprovado, sem permitir escapes arbitrarios do manifesto do modulo.
- XML, listagem e descoberta nunca importam entrypoint, schema JS ou CSS.
  Importar um schema que reexporta `module.js` tambem executa codigo: isso so
  pode ocorrer no build de fontes locais confiaveis, nunca durante a varredura.
- Reusar e revisar o carregador de estilos da outra frente. Preservar sua
  autoridade de assets aprovada pelo host; valores de instancia nao se tornam
  URLs de CSS. Gerar o mapa junto com o pacote/deploy e validar deduplicacao,
  navegacao, erro e cleanup. Hashes garantem integridade, nao confianca no codigo.
- Revisar `url()`/`@import` do CSS no pacote, e nao somente a URL do `<link>`.
  Nao concatenar CSS CAMAP a superficies globais do painel.

### 5.6 Persistencia, instalacao e atualizacao

Na primeira entrega, preferir metadados versionados em `ManifestJson`, sem
novas colunas: identidade, perfil do manifesto, origem, versao, fingerprint e
referencias de assets aprovadas. Manter os campos que o catalogo ja consome,
incluindo `params`, e preservar metadados desconhecidos legados. Guardar o
XML original no pacote e seu hash/URL nos metadados, evitando inflar a coluna.
Templates usam seu repositorio distinto; nao forcar seu cadastro em Extensions.

O schema declara indice unico de `Key`, nao da identidade qualificada guardada
em JSON; o provisioning atual marca criacao de indices como nao suportada.
Nao assumir que a restricao ja existe no tenant. Comprovar `Indexed` e
`EnforceUniqueValues` no campo SharePoint e a rejeicao atomica de duas criacoes
concorrentes; uma verificacao apenas no cliente nao basta. Instalacao/criacao
nao possui ETag de registro previo para resolver essa corrida.

O preflight deve demonstrar que todas as sessoes derivam a mesma chave
canonizada/alias para a mesma identidade. Se os legados impedirem essa garantia,
planejar uma coluna de identidade unica por migracao aditiva antes de habilitar
o novo fluxo. Detectar duplicatas antes de ativar unicidade e parar sem exclusao
automatica. Esse caso exige inspect/provision/verify de campos e restricoes,
teste de concorrencia e reversao de dados; nao remover coluna nem renomear
registros automaticamente. Sem restricao atomica comprovada, o gate fica aberto.

A instalacao deve reler o manifesto e conferir fingerprint, raiz/revisao de
configuracao e hashes de todos os artefatos declarados no inventario aprovado,
incluindo dependencias do grafo, antes de gravar. Pode ler bytes de JS nessa
validacao, mas nunca importa-los/executa-los. Candidato ou pacote alterado desde
a descoberta exige novo scan. A fonte deve ser uma raiz versionada imutavel
sob controle do publicador autorizado; uma checagem de hash no browser nao
impede alteracoes posteriores de arquivos mutaveis. Se essa premissa nao puder
ser sustentada, bloquear o rollout em vez de declarar protecao contra TOCTOU.
Repetir a instalacao nao pode duplicar registros; concorrencia deve
ser decidida tambem pela unicidade persistida, nao so pelo botao desabilitado.
Manter registro desabilitado e habilitacao explicita; publicar uma instancia
permanece independente.

Criar caso de uso dedicado de atualizacao para mudar a revisao/entrypoint da
mesma identidade, com ETag capturado no plano/preview, diferencas e snapshot
anterior. Usar `If-Match` especifico, nunca wildcard; se a releitura encontrar
outro ETag, abortar e exigir nova revisao, sem usar o ETag novo para sobrescrever
uma alteracao que o usuario ainda nao viu.
Nao afrouxar `extensions.update` genericamente. Preservar chave, ID, instancias,
settings, atributos nao declarados e estado de habilitacao. Defaults novos nao
reescrevem dados salvos; incompatibilidade de parametros bloqueia antes da
escrita e requer migracao declarativa separada, nunca script arbitrario.

Na remocao, manter a guarda atual contra instancias dependentes e nao apagar
assets imutaveis. A tela e a documentacao devem distinguir remocao de registro
de limpeza de arquivos. Operacoes em lote precisam de preflight e resultados
por item, pois nao ha transacao atomica entre todas as listas e arquivos.

## 6. Implementacao em incrementos com gates

### I0. Consolidar a base e congelar contratos (risco medio)

1. Revalidar os HEADs e as alteracoes locais da outra frente; acordar um
   checkpoint antes de tocar `app.js`, staging e testes compartilhados.
2. Comparar seletivamente `prepare-minijoomla-modules.js`, `module-styles.js`,
   testes e seguranca da ref CAMAP2. Portar para a arvore `libraries/` atual
   somente o necessario, sem merge amplo de arquivos antigos ou `tmp/`.
3. Registrar a diretriz no prompt/README e atualizar a matriz
   `JOOMLA-EQUIVALENCE.md`, distinguindo suportado, adaptado e nao suportado.
4. Corrigir o contrato de bytes do artefato CAMAP2: reproducao em checkout
   Windows e LF, politica `.gitattributes` restrita aos artefatos de release,
   geracao antes dos hashes e verificacao posterior dos mesmos bytes. Nao
   fazer normalizacao global do repositorio nem modificar releases remotas.
5. Congelar o perfil XML v1, identidades/aliases, raizes, campos e asset policy.

Gate: baseline reproduzivel, conflito de frentes resolvido e nenhum dado
legado renomeado. O teste CAMAP2 de checksum deve passar sem relaxar a verificacao.

### I1. Perfil XML e descritor normalizado (risco alto)

Implementar parser/adapter XML em `libraries/minijoomla/application`, reutilizar
validadores existentes e adicionar fixtures positivas/negativas. Integrar o
gerador nativo aos testes de leitura, incluindo tipos/defaults sem perda.
Nao alterar ainda a composicao publicada ou o fluxo JSON legado.

Gate: XML de modulo valido produz o mesmo contrato de dominio usado pelo painel;
PHP/scriptfile/SQL essencial, erros de identidade e XML hostil sao reportados
antes de qualquer import ou escrita. Testes JSON existentes permanecem aprovados.

### I2. Porta de diretorios e raizes configuradas (risco alto)

Adicionar `listFolders` e continuacao paginada na API SPMIDDLE, em seu proprio
repositorio, preservando as formas de resposta de `listFiles` existentes.
Disponibilizar uma porta de leitura estreita para o core, com fake e adapter
de filesystem local para fixtures; nao introduzir REST dentro da UI.

Configurar separadamente raizes de XML, JSON legado e inventario nativo no
host. Atualizar staging dos pacotes SPMIDDLE necessarios. Uma raiz opcional
inexistente pode ser reportada como ausente; raiz configurada com 403/erro de
rede nao equivale a zero extensoes. Seguir apenas continuacoes autorizadas e
limitar ciclos, escopo e volume. Cada continuacao deve ser analisada como URL:
mesma origem/site e mesma colecao/pasta autorizada no recurso REST decodificado,
sem trocar a requisicao por outra lista/pasta ou host. Detectar tokens/links
repetidos e limitar paginas; reutilizar a regra existente do cliente de listas
somente apos provar que ela cobre endpoints de arquivos/pastas. Propagar
cancelamento/`AbortSignal`; download limitado deve conferir tamanho anunciado
e bytes efetivamente recebidos, sem depender apenas do tamanho informado.

Limites iniciais propostos para medir e calibrar: XML de ate 64 KiB; 50 campos;
500 pastas e 200 candidatos por varredura; profundidade maxima quatro;
concorrencia quatro; deadline de 60 segundos. O scanner normalmente precisa
de apenas um nivel para modulos e dois para plugins. Limite atingido deve
marcar resultado incompleto; nao anunciar varredura integral.

Gate: arvore sintetica paginada e erros de permissao testados; nenhuma operacao
POST/MERGE/DELETE durante scan; cliente legado sem `listFolders` continua
operando a descoberta JSON, sem fingir suporte ao modo XML.

### I3. Descobrir e instalar modulos de site (risco alto)

Combinar adapters JSON/XML no servico, classificar candidatos e deduplicar pela
identidade, nao apenas por arquivo ou titulo. Estender o controller
`administrator/components/com_installer/src/Controller/discover.js` e a view
`com_installer/tmpl/discover/default.js` que a outra frente esta extraindo;
nao criar uma segunda tela paralela. Rever o checkpoint antes da integracao e
preservar rotas existentes e APIs usadas pelos testes.

Mostrar lista Joomla-like com nome, tipo, cliente, versao, origem, estado e
motivo de bloqueio. Reusar selecao/acoes padrao; distinguir instalado,
atualizacao disponivel, invalido, nao suportado e leitura incompleta. Nao
esconder candidatos PHP como se a pasta estivesse vazia.

Mover a escrita de instalacao para um servico testavel que releia/valide os
candidatos; a UI nao deve confiar em URLs transportadas apenas por atributos
DOM. Manter confirmacao e instalacao desabilitada. Padronizar validacao entre
manifesto colado e descoberto, sem quebrar a tolerancia documentada do JSON legado.

Gate: descobrir nao altera listas nem executa codigo; instalar grava somente o
registro esperado; reentrancia, duplo clique, corrida entre sessoes e manifesto
alterado depois do scan nao geram duplicacao ou instalacao nao revisada.

### I4. Pacote CAMAP2 e piloto corpmessage (risco medio/alto)

Criar um target Joomla-like no empacotador CAMAP2, sem mover as fontes atuais
em lote nem invalidar o pacote anterior. Reusar o gerador da outra frente para
traduzir schemas/defaults e acrescentar XML como descritor principal do target.
O target deve incluir XML em sua allowlist; hoje isso nao ocorre.

Arvore de saida proposta para o piloto, relativa a raiz versionada do pacote:

```text
modules/mod_camap_corpmessage/
    mod_camap_corpmessage.xml
    mod_camap_corpmessage.js
libraries/camap/extensions/camap/
    _shared/render.js
    mod_camap_corpmessage/module.js
media/mod_camap_corpmessage/css/mc.css
```

O entrypoint padronizado pode ser um adapter/reexport minimo para o modulo
original empacotado, preservando imports e identidade. Aqui o adapter tem
funcao de compatibilidade; nao criar `tmpl/default.js` ficticio so para imitar
o filesystem Joomla. Se o layout for separado futuramente, ele deve conter
renderizacao efetiva. Helpers compartilhados devem existir uma vez por pacote,
com dependencias e imports fechados e validados.

O XML deve declarar `message`, `author`, `align` e seus defaults/opcoes. Mapear
posicoes antigas `content`/`home-c` explicitamente para o template selecionado,
sem substituir por `main-top` silenciosamente. Uma posicao indisponivel exige
escolha do administrador; instancias existentes ficam preservadas.

Gerar mapa de assets aprovado, aliases, inventario SHA-256 e todos os demais
artefatos a partir da fonte unica. Compatibilidade JSON pode ser gerada para
consumidores antigos, nunca mantida manualmente como segunda autoridade.
Gerador apenas offline; nao sobrescrever saida existente sem alvo validado e
nao importar fontes nao confiaveis para tentar descobrir seus schemas.

Gate: o pacote real do piloto e descoberto pelo mesmo servico da aplicacao;
parametros chegam ao admin e ao render, helper resolve, CSS e aplicado pelo
mecanismo aprovado, render vazio/erro e escaping permanecem corretos. Pacote
anterior continua valido, sem diferenca inesperada nas chaves/contratos.

### I5. Atualizacao, reversao e compatibilidade (risco alto)

Implementar o caso dedicado de atualizacao, idempotencia, ETags e reversao dos
metadados. Testar identidade logica tanto em registros novos quanto legados
sem os metadados adicionais. Nao exigir backfill massivo para poder ler.

Gate: atualizar preserva IDs, settings e referencias; versao anterior continua
disponivel; ETag obsoleto falha sem gravacao parcial. Rollback rele metadados
e ETag atuais e restaura apenas os campos da operacao, sem sobrescrever edicao
alheia. Remocao de registro com instancias continua bloqueada.

### I6. Integracao e publicacao controlada (risco alto)

Depois de todos os gates locais, preparar nova release imutavel do runtime e
pacote independente do piloto; nao reutilizar numero nem sobrescrever 0.5.1.
Usar destino pessoal documentado nesta frente; nao acessar tenant corporativo
ou `hub-ai`. Publicacao futura depende do escopo/autorizacao aplicavel nessa
etapa e nao decorre do presente pedido de plano. Separar o gate local do gate
de host: antes deste ultimo, reler o alvo exato no prompt de retomada, confirmar
site pessoal e paginas `MiniJoomla.aspx`/`Administrator.aspx` e reconhecer o
escopo/autorizacao vigente. Nunca substituir esse alvo pelo tenant corporativo.

Ativacao proposta: publicar e verificar o pacote externo primeiro; gerar uma
nova configuracao de raizes/assets dentro do host imutavel; depois mudar os
loaders das paginas com ETags capturados. Essa sequencia nao e transacao atomica
entre paginas: manter diario por etapa e reverter uma ativacao parcial com
snapshots/ETags relidos. O loader anterior deve retomar tambem a configuracao
anterior de raizes/assets. Testar leitura dos metadados novos pelo runtime de
rollback ou manter o piloto desabilitado durante a reversao. Se for preciso
provisionar unicidade/colunas, nao usar `--skip-provision` para esconder essa etapa.

Conferir hashes por releitura independente, MIME XML/JS/CSS, cache, CSP e grafo
de imports. Navegador somente pela instancia propria do FIORI-AUTO .NET 9,
com portas/perfil proprios. O problema de inventario de listeners documentado
precisa de solucao ou evidencia valida de posse; nao enfraquecer o gate nem
usar outro navegador para declarar aceite.

Gate: E2E real do piloto, navegacao/publico/admin, gravacao e concorrencia,
restauracao demonstrada e documentacao atualizada. Smoke de carregamento nao
substitui os testes de escrita ou de lifecycle.

### I7. Ampliacao apos aceite do piloto

Migrar os demais dez modulos CAMAP um a um por pacote gerado e sem reescrever
seus dados. Depois acrescentar XML de plugins e templates: paths e semantica
de grupos, eventos, templateDetails.xml, posicoes e assets devem ser validados
separadamente. Componentes externos, idiomas e instalacao de ZIP requerem novos
contratos e analise de seguranca; nao ficam implicitamente implementados pelo
parser XML generico.

## 7. Matriz de testes obrigatoria

| Grupo | Casos minimos | Prova esperada |
| --- | --- | --- |
| XML | Documento valido, BOM/UTF-8, CDATA, escape, namespace, malformado, DTD/XXE, profundidade/tamanho | Parser real no Node e no browser; nenhum fetch de entidades |
| Semantica | Pasta/XML/element divergentes, version ausente, tipos/clientes, arquivo JS ausente, PHP-only, scriptfile/SQL | Candidato e motivo corretos; nenhuma execucao |
| Parametros | list/radio booleano e nao booleano, string/numero/default, JSON explicito, limite, duplicata, prototype keys, campo customizado | Admin e runtime recebem os mesmos tipos; sem perda de defaults |
| Diretorios | modules, plugins por grupo, templates, mais de uma pagina, loop de continuacao, 403/404/429/5xx, cancelamento | Completo/incompleto distintos; caminhos fora da raiz rejeitados |
| Identidade | XML+JSON do mesmo modulo, duas raizes/versoes, alias nativo, duas sessoes instalando | Sem duplicatas ou escolha silenciosa; preservacao de keys existentes |
| Instalacao | Scan sem escrita/import, candidato alterado, confirma/cancela, registro desabilitado | Uma gravacao valida e nenhuma habilitacao/publicacao automatica |
| Runtime | Import real no layout de pacote, modulo inativo, params, CSS deduplicado/cleanup, erro CSS/import, helper unico | Nao derruba a pagina nem vaza estilo para o painel |
| Ciclo de vida | Atualizar/reverter com ETag, settings desconhecidos, referencias e defaults, remover com dependencias | Dados preservados; sem exclusao de assets/instancias |
| Pacote | Fonte versus artefato, XML/JS/CSS/imports, symlink/junction, saida fora da raiz autorizada, case collision, LF/CRLF | Contencao da saida, repeticao deterministica e mesmos bytes/SHA-256 em checkout limpo |
| Regressao | JSON bruto legado, formularios, instancia, plugins/template atual, readonly scan, suites sem SPMIDDLE | Mesmos contratos existentes; falhas nao convertidas em skips |
| Host real | Raiz correta, rede/permissoes, descobrir/instalar/configurar/publicar/atualizar/reverter | Evidencia via FIORI-AUTO e releitura independente dos dados/assets |

O gate de saida exige a baseline completa do MINIJOOMLA, checks CAMAP2 e
SPMIDDLE relevantes, staging `core/site/all`, contributor isolado, importacao
do artefato final e `git diff --check`. Nao fixar o numero 58 como meta futura:
a suite deve crescer. Browser deve verificar teclado, foco, estados de erro e
reflow da lista/modal modificadas; screenshots/DOM nao provam aceite assistivo.

### Roteiro E2E do corpmessage

1. Publicar novo pacote em raiz aprovada, com XML e entrypoint padronizados,
   sem JSON de descoberta manual; registrar o inventario de hashes.
2. Descobrir o modulo pelo XML e comprovar que o scan nao escreveu dados nem
   carregou seu JS/CSS. Repetir scan sem duplicacao.
3. Instalar explicitamente, conferir chave/identidade e estado desabilitado.
4. Habilitar; criar instancia com mensagem, autor e alinhamento; salvar e
   reler via servico/repositorio real e ETag.
5. Publicar a instancia em posicao suportada; verificar render, escaping,
   CSS carregado uma vez, helper e ausencia de recursos 404/MIME incorreto.
6. Editar os tres campos, testar dados invalidos e ETag obsoleto; navegar entre
   paginas, desabilitar/reativar e verificar lifecycle dos assets.
7. Publicar segunda versao do pacote, apresentar diferencas, atualizar com
   settings preservados e exercitar rollback para a versao anterior.
8. Tentar remover o registro com instancia associada e comprovar a guarda;
   limpeza dos dados de teste so por acao explicita e no alvo autorizado.

## 8. Coordenacao, riscos e estrategia de entrega

Divisao recomendada quando a implementacao for iniciada:

| Frente | Responsabilidade exclusiva | Dependencia |
| --- | --- | --- |
| A: manifesto/dominio | Parser, normalizacao, identidade e testes de contratos | I0 |
| B: transporte | SPMIDDLE pastas/paginacao, fakes e testes de leitura | Contrato de I2 fixado |
| C: pacote CAMAP2 | Gerador/empacotador, schemas, alias e assets do piloto | Descritor de I1; revisao da outra frente |
| Coordenacao/integracao | Host, `com_installer`, runtime/styles, staging, E2E e revisao | A/B/C e checkpoint da frente administrativa |

Executar com o menor numero util de agentes, worktrees irmas por branch e sem
escrita concorrente no mesmo arquivo. Nao criar essas worktrees nesta etapa.
Commits por incremento no repositorio dono; agregador registra ponteiros quando
necessario. Nao executar commit/push, merge em main ou deploy por inferencia
de autorizacoes antigas de outra etapa.

Riscos prioritarios e respostas:

- Duas frentes evoluindo o admin: checkpoint e integracao seletiva antes da UI.
- Nova descoberta duplicar nativos/legados: identidade qualificada e alias
  persistente; fixture que inclui simultaneamente XML e JSON.
- Parecer compativel com Joomla PHP sem ser: perfil JS explicito, candidatos
  nao suportados visiveis e matriz de suporte publicada.
- Manifesto mudar entre scan e install: releitura/fingerprint e preflight.
- Instancias perderem configuracao ao atualizar: manter ID/key, ETags e valores
  desconhecidos; atualizacao separada do CRUD generico.
- CSS/imports fora do pacote: catalogo aprovado, grafo fechado e teste real do
  artefato; same-origin sozinho nao e autorizacao suficiente.
- Integridade afetada por checkout: politica de bytes de release e CI em
  Windows/LF, sem afrouxar SHA-256.
- Nao haver permissao de listar subpastas: erro explicito e nenhum fallback
  privilegiado ou alteracao de TLS/proxy/permissoes.

## 9. Rollback e criterios de conclusao

Cada incremento local deve ter commit de checkpoint e diff focalizado.
Rollback de implantacao retorna ao loader/runtime anterior e a configuracao
anterior de raizes/assets; pacotes anteriores permanecem intactos. Se houve
escrita de registro, o rollback deve analisar a diferenca e usar ETags atuais,
sem restauracao massiva ou exclusao automatica. O perfil JSON permanece
disponivel durante e depois do piloto.

A primeira melhoria so estara concluida quando:

- Um desenvolvedor entregar `modules/mod_x/mod_x.xml` + JS suportado sem manter
  JSON sidecar ou duplicar manualmente campos do painel.
- Descobrir identificar esse pacote na raiz aprovada, com diagnostico claro
  quando incompleto/nao suportado e sem executar codigo.
- Instalar, habilitar, configurar, publicar, atualizar e reverter o piloto
  funcionarem com assets, ETags e dados preservados.
- Todos os contratos legados e a baseline de testes permanecerem aprovados.
- A outra equipe receber contrato XML/perfil JS, matriz de suporte, exemplos
  neutros, comandos de build/teste, configuracao das raizes e rollback.

Nao declarar equivalencia integral ao Joomla. A documentacao final deve dizer
precisamente quais comportamentos sao iguais, quais sao adaptados ao SharePoint
e quais continuam fora do runtime JavaScript.
