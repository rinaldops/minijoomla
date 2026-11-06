# Joomla Sample Data — população após publicação limpa

## Resultado

Após confirmar o funcionamento do frontpage/painel, o responsável autorizou
commit/push e, em seguida, população das listas com dados de exemplo do Joomla
original. O commit **`57ef821`** foi enviado a `origin/main` antes da carga.
Os patches locais não ativos na 0.8.0 ficaram fora desse commit.

A população foi executada **pelos serviços administrativos da release 0.8.0**,
na sessão própria FIORI-AUTO do destino corporativo autorizado. Não foi
executada por um botão Sample Data: essa rotina ainda não existe no painel.
Nenhum item da instalação reciclada foi restaurado, nenhum ID anterior foi
reutilizado e nenhum asset da release ativa foi sobrescrito.

| Lista / domínio | Registros após releitura |
| --- | ---: |
| Artigos | 11 |
| Categorias | 4 |
| Tags | 4 |
| Itens de menu | 8 |
| Extensões: plugins nativos de conteúdo | 4 |
| Templates: Cassiopeia | 1 |
| Instâncias de módulos | 7 |
| Configuração do site | 1 |
| **Total** | **40** |

**12 imagens originais** foram publicadas em pasta própria nova de sampledata,
com bytes/tamanho/SHA-256 comparados aos arquivos do checkout Joomla e MIME JPEG
conferido na releitura. A release de código permanece 0.8.0.

## Origem e tradução para os contratos suportados

Referência Joomla fixada em `52559589cb6a02c9e2fc48270f92b3aff7b8b7a0`:

- `plugins/sampledata/blog/src/Extension/Blog.php`;
- `administrator/language/en-GB/plg_sampledata_blog.ini`;
- `installation/sql/mysql/base.sql` para plugins nativos;
- JPEGs de `images/sampledata/cassiopeia/` e `images/banners/banner.jpg`.

Os 11 títulos e textos foram obtidos novamente da fonte, não copiados dos
snapshots de listas anteriores. Há somente adaptação do link interno de
Typography `index.php` para a rota inicial hash suportada. Categorias Blog,
Help, Joomla e Typography preservam a associação dos artigos; tags Millions,
Worldwide, Love e Joomla 6, com a quarta tag filha da terceira. IDs reais foram
materializados a partir dos resultados de criação.

Os oito menus suportados incluem a hierarquia Sample Layouts → Category List /
Articles. Referências de pais foram gravadas e verificadas, não apenas os títulos.
Rotas PHP/admin/senha/ACL sem consumidor não foram apresentadas como links
operacionais. Não foram criados workflows, usuários, fields ou feeds fictícios.

Configuração Cassiopeia e categoria inicial Blog explícitas; quantidades
4 leading / 4 intro / 0 links da referência, parâmetros traduzidos para o
runtime. As sete instâncias incluem Latest Posts (categoria Joomla/3/title ASC),
Older Posts (Blog/6/oldest), arquivo, tags, itens relacionados, busca e banner.
Menu/breadcrumbs ficam no shell, sem duplicar instâncias não selecionáveis.

Foram registrados os quatro plugins nativos de conteúdo habilitados na
referência base: emailcloak, loadmodule, pagebreak e pagenavigation, em sua
ordem original. O registro Cassiopeia aponta para o recurso da release ativa;
`Styles` vazio mantém somente o CSS nativo, não estilos da instalação removida.

As imagens usam URLs do site para os JPEGs reais, alt/captions da referência
(inclusive créditos NASA), não fragments `joomlaImage://`. O banner inclui a
imagem original como elemento, sem simular suporte a CSS arbitrário. Autoria
editorial genérica e idioma `*`; campos Created/Modified ficam com o SharePoint.

## Interrupções e continuação controlada

A primeira fase gravou 27 registros (conteúdo/taxonomia/menus) e parou com HTTP
400 ao cadastrar um plugin. Diagnóstico identificou `Folder` como colisão com
propriedade de navegação SharePoint no payload. **Nenhum registro foi excluído
nem a carga integral repetida.** Para esta carga, grupo `content` permanece no
`ManifestJson`, contrato já suportado pelo runtime; `Folder` foi omitido.

A continuação capturou o ETag real do registro nativo criado no diagnóstico e
comparou identidades/valores/ETags de todos os registros já existentes. Uma
verificação conservadora interrompeu antes de novos creates pela serialização
equivalente de datas do SharePoint; comparar os instantes resolveu essa etapa.
Somente registros ainda ausentes foram criados. Não houve update cego, wildcard,
duplica ou descarte de dados para fazer o teste passar.

O conflito `Folder` continua um ponto a corrigir no fluxo genérico de cadastro
de plugins; esta carga não alterou código de produção, campo ou schema para
mascará-lo. A API publicada aceita grupo pelo manifesto, mas não foi declarada
correção global de todas as escritas dessa coluna.

## Verificação e limites

- Prévia local com o serviço administrativo publicado e repositórios em memória
  passou o plano inteiro. A primeira fixture cruzava realms no VM e foi corrigida
  apenas no teste, sem relaxar validação de objetos no runtime.
- Releitura independente: **101 verificações aprovadas**, contagens, ETags,
  textos, imagens e referências. Os registros persistidos foram consumidos por
  novo carregamento de frontpage, sem substituí-los por fixtures.
- Frontpage: textos originais, menus hierárquicos e cinco imagens visíveis
  carregadas; nenhum erro HTTP nos recursos MINIJOOMLA observado nessa janela.
- Painel: lista de artigos populada, editor TinyMCE único e imagem persistida
  no formulário. Fixture inicial procurava um nome de campo incorreto; após
  usar o nome contratual `images:image_intro`, reexecução passou.
- Sampledata adaptado aos contratos existentes **não é instalação integral
  Joomla PHP**, fidelidade visual integral, i18n, SEO do host, histórico editorial
  ou check-in/check-out. Per-menu options/grupos de menu, floats de figuras e
  layouts de módulos que o runtime não suporta não foram inventados.
- Cabeçalhos/avisos de código original são GPL-2.0-or-later; correspondência com
  arquivos locais/créditos não é certificação jurídica ou de origem autenticada
  de toda a distribuição. Esta carga não concede liberação pública do projeto.
- Não repetir a operação sobre listas não vazias. Recuperação exige os recibos
  privados e ETags relidos dos registros efetivamente criados; não apagar listas
  nem restaurar backup global como rollback de população. Rollback não executado.

Planos, payloads, GUIDs, dados/ETags, mídia e evidências do host estão apenas em
`tmp/populate-joomla-20261106/`, ignorado pelo Git. Nenhum desses valores é
incluído neste relatório ou no push. Próxima implementação separada: instalação
de Sample Data pelo próprio painel, com confirmação, idempotência e recuperação.
