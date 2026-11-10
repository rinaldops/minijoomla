# Extensoes Joomla no MiniJoomla

> Evolução incluída em 06/11/2026: adoção dos outros dez módulos, perfis XML de
> plugins/templates e migração assistida. [Contratos e gates](CONTRATOS-EVOLUCAO-XML.md).
> O suporte descrito abaixo continua sendo o perfil de módulos implementado;
> planejamento não habilita novos tipos nem converte dados automaticamente.

## Contrato implementado

O perfil `joomla-xml-v1` descobre modulos JavaScript de site por
`modules/mod_nome/mod_nome.xml`. O XML e a fonte dos parametros do painel;
nao e necessario manter um manifesto JSON de descoberta para esse pacote.
O cadastro instalado continua usando o armazenamento existente do MiniJoomla.
Modulo e um tipo de extensao; registro, habilitacao e instancia sao etapas
distintas, como no Joomla.

```xml
<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade">
  <name>Mensagem</name>
  <version>1.0.0</version>
  <files>
    <filename module="mod_mensagem">mod_mensagem.js</filename>
  </files>
  <media destination="mod_mensagem" folder="media">
    <filename>css/mensagem.css</filename>
  </media>
  <config><fields name="params"><fieldset name="basic">
    <field name="message" type="textarea" label="Mensagem" default="" />
  </fieldset></fields></config>
</extension>
```

O entrypoint exporta o contrato JavaScript de modulo existente (`default` com
`render`). Arquivos declarados em `files` ficam na pasta instalada do modulo;
os de `media` ficam em `media/<destination>/`. Imports e dependencias precisam
estar no pacote aprovado. Descobrir nao copia arquivos nem importa JavaScript.

| Recurso | Suporte nesta entrega |
| --- | --- |
| XML UTF-8, comentarios, CDATA e escapes | Parser XML real, compartilhado entre Node e navegador |
| Configuracao | text, textarea, number e demais tipos normalizados existentes; list e radio |
| Radio booleano | Par de opcoes 0/1 normalizado para booleano |
| JSON estruturado | Atributos `mj:type="json"` e `mj:valueType="array\|object"` |
| Chave legada | `mj:key` preserva a chave; sem alias usa o nome `mod_nome` |
| Namespace MiniJoomla | `xmlns:mj="urn:minijoomla:runtime:1"` |
| Descoberta JSON anterior | Preservada; conflito XML/JSON e mostrado, sem escolha silenciosa |
| Atualizacao e reversao | Revisoes XML aprovadas, ETag capturado e validacao das instancias |
| Remocao | Bloqueada quando existem instancias; nao apaga arquivos do pacote |
| PHP, SQL, scriptfile e DTD | Recusados; nao ha interpretador PHP nem execucao de instaladores |
| Campos customizados, required/multiple, filtros/validadores, showon | Recusados quando requerem comportamento nao implementado |
| Plugins/templates XML, componentes externos, idiomas e ZIP | Fora deste primeiro perfil; fluxos legados permanecem |

Isto e compatibilidade de estrutura e fluxo, nao compatibilidade binaria com
extensoes PHP do Joomla. Novos tipos de extensao exigem contratos proprios.

## Aprovacao e integridade

A composicao do host fornece `joomlaDiscoveryRoots`: identificador, `baseUrl`
server-relative, `immutable: true` e hash SHA-256 dos bytes exatos de
`MANIFEST-SHA256.json`. O inventario `minijoomla-joomla-package-v1` relaciona
arquivos, tamanhos, hashes, `moduleKeys` e `moduleStyles`.

O scan le apenas diretorios e XML, com limites e cancelamento. A instalacao
rele o XML e verifica o inventario fixado e todos os arquivos. Uma busca
incompleta nao emite candidatos instalaveis. Aprovacao por hash nao e uma
sandbox: o publicador precisa revisar o JavaScript e manter as raizes
imutaveis tambem no servidor. Uma versao publicada nunca deve ser sobrescrita.

No SharePoint, instalar requer que o campo `Key` da lista de extensoes seja
realmente Text, Indexed e EnforceUniqueValues. A declaracao no schema nao e
prova: o guard consulta a lista real e bloqueia quando nao ha essa garantia.
Este fluxo nao altera automaticamente constraints nem corrige duplicatas.

`moduleStyles` e `moduleStyleRevisions` sao mapas aprovados do host, nao
parametros da instancia. O segundo seleciona CSS pelo entrypoint instalado,
permitindo reverter sem aplicar o estilo da versao mais nova. A navegacao
deduplica links e remove os que deixaram de ser necessarios.

## Pacotes e ciclo de vida

O CAMAP2 possui o gerador `tools/prepare-joomla-modules.js`. Execute naquele
projeto, depois de `npm ci`, usando uma pasta de saida nova:

```powershell
node tools/prepare-joomla-modules.js --base /sites/exemplo/SiteAssets/pacotes/1.0.0 --out tmp/piloto-1.0.0 --version 1.0.0 --module mod_camap_corpmessage
```

O comando gera XML/JS canonicos, helper compartilhado, CSS, inventario e
`host-config.json`. Sem `--module`, prepara os onze modulos; isso nao instala
nem migra automaticamente nenhum deles. JS/CSS proprios sao canonizados para
LF antes da escrita e do hash. Parsers de ES modules e CSS verificam o grafo
local; URL/@import CSS nao declarados sao recusados.

Publique previamente esse pacote em uma raiz nova aprovada. O publicador
de MiniJoomla aceita `--extensions-config <host-config.json>`; argumentos
repetidos vao da revisao mais antiga para a mais nova. Raizes antigas
permanecem aprovadas para rollback, mas so as da ultima configuracao sao
descobertas. Antes da ativacao, o publicador verifica os pacotes remotos e a
unicidade real de Key; nao habilita modelos nem ignora erros de permissao.

1. Descobrir e confirmar Registrar; o registro nasce desabilitado.
2. Habilitar e criar/configurar uma instancia pelo fluxo existente.
3. Para atualizar, manter o pacote anterior aprovado e acrescentar a nova
   configuracao de raiz/assets ao host; confirmar Atualizar na descoberta.
4. Atualizar preserva ID, chave, estado e settings das instancias, incluindo
   propriedades desconhecidas. Incompatibilidade de parametros ou ETag
   interrompe a gravacao. Nao ha migracao automatica de dados.
5. Reverter versao revalida o pacote anterior e restaura URL/metadados pelo
   ETag atual da tela. Guarda-se uma revisao anterior, nao um historico infinito.

O SharePoint nao oferece transacao atomica entre a extensao e todas as suas
instancias. Por isso, o ciclo automatico exige o mesmo contrato normalizado de
validacao dos parametros (nomes, tipos, defaults, limites e valores de opcoes).
Rotulos e descricoes podem mudar. Alteracoes de schema exigem migracao assistida;
reler instancias apenas antes do update nao seria suficiente contra uma edicao
concorrente. No site aberto, o loader troca JS e CSS pela revisao instalada na
proxima navegacao; a reversao reaproveita o cache do import original.

A atualizacao direta de registro JSON legado para XML e bloqueada, pois nao
ha revisao XML anterior verificavel. A migracao precisa de um procedimento
assistido que preserve dados e defina rollback; nao exclua instancias para
contornar essa guarda.

## Verificacao

`npm test` cobre XML, descoberta, integridade, concorrencia, ETags, rollback,
configuracao confiavel e ciclo dos links CSS. `npm run check` verifica sintaxe.
O staging `core/site/all` inclui as dependencias necessarias; o parser XML
leva sua licenca ISC original. O pacote contributor usa allowlist explicita.

Testes locais e doubles nao substituem o aceite real no SharePoint. Antes de
ativar uma release, executar descobrir/instalar/configurar/publicar/atualizar/
reverter pelo FIORI-AUTO em sessao propria, com releitura independente de dados,
ETags, MIME/assets e evidencias de teclado e reflow. Nao apagar dados reais
automaticamente. O plano de implantacao e suas evidencias ficam separados do
contrato portavel.
