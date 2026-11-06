# MINIJOOMLA — site consumidor do Site Kernel (mse-platform)

**Status:** código criado, sem provisionamento nem publicação em tenant
real (mesmo status das fases 0–3 do kernel — ver
`mse-platform/docs/PLANO-SITE-KERNEL-MSE.md`). Qualquer publicação exige
confirmar o destino de produção e a autorização aplicável (regra do
workspace).

## 1. O que é

Um "Joomla-like" sem autenticação/segurança própria, em JavaScript, para
rodar embutido numa página SharePoint via Modern Script Editor — não um
projeto isolado, e sim o **segundo consumidor** do Site Kernel do
`mse-platform` (o primeiro, planejado, é `CAMAP-AGP`). Reaproveita
integralmente `kernel/`, `components/com_*`, `host-adapters/
modern-script-editor/` do mse-platform; esta pasta só contém
configuração/documentação/tema específicos deste site — nenhum código de
kernel, componente ou módulo é duplicado aqui (mesmo padrão de divisão de
responsabilidades produto×site do plano do kernel, seção 12).

Referência visual/conceitual: `mse-platform/Joomla6.2.0/` (instalação local
do Joomla! 6.2.0, só para consulta de estrutura — não é dependência de
runtime). Referência de acesso a dados: `web-devs/SPMIDDLE` (middleware
JS client-side para SharePoint).

## 2. Por que nenhuma autenticação própria

O Site Kernel já não tem ACL/autenticação própria (decisão já tomada no
plano do kernel): a autorização é 100% nativa do SharePoint
(`EffectiveBasePermissions`), nunca uma camada própria do mini-Joomla. O
MINIJOOMLA herda isso sem nenhum código adicional — **fora de escopo, de
propósito**: `com_users`, `com_login`, sessões, CSRF, captcha, API
webservices (`api/` do Joomla! real), qualquer coisa de
`plugins/authentication/*`/`plugins/user/*`/`plugins/privacy/*` do Joomla!.

## 3. Nomenclatura: 100% oficial Joomla! nas listas/campos SharePoint

Exigência do usuário: listas e campos seguem a convenção oficial do
Joomla! (`MSE<TabelaJoomla>`), rejeitando adaptações em português. As 9
listas de infraestrutura do kernel já estavam migradas para esse padrão
(`docs/JOOMLA-CONVENCOES-E-MIGRACAO.md` do mse-platform); a única lacuna
(conteúdo/artigos) foi fechada nesta entrega com uma lista nova:

| Lista | ≈ Joomla! | Campos principais |
| --- | --- | --- |
| `MSEMenuTypes` | `#__menu_types` | Key, Description |
| `MSEMenu` | `#__menu` | Alias, ParentId, MenuType, Path, Level, Ordering, Component, View, Default, Target, Published, TemplateStyleId |
| `MSEExtensions` | `#__extensions` | Type, Element, ClientId, Version, Enabled, Protected, Ordering |
| `MSEModules` | `#__modules` | Module, Position, Ordering, Published, PublishUp, PublishDown, ShowTitle, Style, MenuAssignment |
| `MSEModulesMenu` | `#__modules_menu` | ModuleId, MenuId |
| `MSETemplateStyles` | `#__template_styles` | Template, ClientId, Home |
| `MSECategories` | `#__categories` | Alias, Extension, Description, ParentId, Level, Ordering, Published |
| `MSETags` | `#__tags` | Alias, Description, Published, Ordering |
| `MSEMedia` | (biblioteca de arquivos, sem tabela Joomla!) | AltText, Description |
| `MSESearchFilters` | `#__finder_filters` | Alias, State, MapCount, ... |
| **`MSEContent`** (novo) | `#__content` | Alias, Introtext, Fulltext, CatId, State, Featured, Ordering, PublishUp, PublishDown |

`MSEContent.CatId` referencia `MSECategories.Id` (mesmo papel do
`catid` real do Joomla!). Nenhuma lista usa prefixo/campo em português —
a tradução para o shape interno do kernel (`estado`/`categoriaId`/
`destaque`, já existente, reaproveitado sem alteração) acontece só na
camada de adaptação (`mse-platform/components/com_content/content-data.js`
e `component.js`), nunca no SharePoint.

Detalhe não óbvio: `kernel/content-services.js#filterPublished` compara o
VALOR de `estado` contra o literal fixo em português `"Publicado"` (não
é configurável por `fieldMap`, que só traduz nomes de campo). Por isso
`content-data.js` traduz o valor de `MSEContent.State`
(`Published`/`Unpublished`/`Archived`/`Trashed`, oficial Joomla!) para o
literal PT que o kernel já espera, só nessa camada de adaptação — sem
tocar `content-services.js`.

## 4. Acesso a dados: SPMIDDLE como client REST

O boot deste site usa `host-adapters/modern-script-editor/
spmiddle-rest-adapter.js` (novo, dentro do mse-platform) em vez de
`core/rest.js` nativo — selecionado via `data-rest-adapter="spmiddle"` no
`site-snippet.html` deste site (ver seção 5). O SPMIDDLE
(`web-devs/SPMIDDLE/packages/sharepoint-rest-browser`) permanece
independente do Site Kernel (conforme sua própria documentação,
`SPMIDDLE/docs/INTEGRATION-MSE-PLATFORM.md`): a ponte vive inteiramente no
adapter do mse-platform, nunca dentro do pacote do SPMIDDLE.

## 5. Template visual

`templates/minijoomla-classic/` (novo, dentro do mse-platform) — layout
inspirado no Joomla! Cassiopeia (cabeçalho, menu principal, breadcrumbs,
grade de conteúdo + lateral, rodapé). Cores/tokens específicos deste site
ficam em `theme/tokens.css` (decisão D9 do plano do kernel — CSS do site
nunca entra no pacote do produto).

## 6. Fora de escopo nesta entrega (deferido, não esquecido)

- `com_finder`/busca real, `com_banners`, `com_contact`, tags na UI
  pública, multilíngue — mesma ordem (D7) já decidida no plano do kernel.
- Migração de dados reais de qualquer lista legada para `MSEContent`.
- Provisionamento real das listas SharePoint deste site e publicação no
  tenant — exige confirmação de destino/autorização separada.
