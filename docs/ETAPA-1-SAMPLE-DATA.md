# Etapa 1 — correções do produto e Sample Data

## Fonte e escopo

Implementação isolada em `MINIJOOMLA-worktree01`, branch
`feat/joomla-finalization-step1`, a partir de `231560b`, que registra a instalação
aceita 0.8.0. A árvore principal com patches anteriores não foi sobrescrita nem
usada como release. Esta entrega não implementa novos perfis XML, executor de
migração, i18n, SEO do host, histórico editorial ou check-in/check-out.

**Estado: implementação local, não publicada nesta etapa.** A carga atual de
40 registros e suas imagens continuam preservadas. O roteiro de publicação
deve apontar para a worktree/commit desta frente, não a árvore principal suja.

## Correções existentes

- Grupo de Plugin preservado em `ManifestJson`, sem enviar a navegação reservada
  `Folder` do SharePoint. Folder textual legado conserva precedência; mudança
  incompatível é recusada, não migrada silenciosamente.
- Folder vazio significa ausência de override; limpeza deliberada usa
  `manifest.group`. Modules conservam group opaco sem interpretação como Plugin.
- Estado/ordem e parâmetros não reserializam manifests existentes; novas
  inscrições mantêm a canonicalização JSON histórica. ETag original preservado.
- Habilitar/desabilitar plugin nativo já registrado não cria outra linha e
  exige ETag. Os quatro nativos atuais continuam legíveis e configuráveis.
- `listLimit/orderBy/resultsLimit/searchPhrases` efetivos nas consultas, rota
  válida acima do salvo, limite ausente preservando pageSize histórico. Blog
  conserva a capacidade por leading/intro/links, sem virar lista genérica.
- Inteiros 1..50, campos próprios de dados, sem consumir getters/protótipos;
  filtro literal all/any/exact com Unicode/espaços normalizados nos dois adapters.
- Metadados públicos preservados para relacionados por keywords, sem SEO do host.
- Leituras administrativas incompletas e configuração singleton duplicada
  interrompem a operação, sem selecionar uma linha por conveniência.

## Organização Joomla e uso

`administrator/modules/mod_sampledata/` fornece a apresentação e bindings;
`plugins/sampledata/blog/` fornece o pacote original traduzido para os contratos
suportados; `libraries/minijoomla/application/sample-data-service.js` executa
o caso de uso por portas administrativas, sem SharePoint ou DOM próprios.

No painel: **Sistema → Dados de exemplo**, rota `#/sampledata`. Também há
link no grupo Sistema do dashboard. Estados:

| Estado | Efeito |
| --- | --- |
| Vazio/ready | Botão de instalação com confirmação explícita |
| Installed | Pacote completo reconhecido; botão desabilitado; não cria nem adota dados |
| Conteúdo diferente/blocked | Recusa escrita, sem substituir artigos/configurações |
| Partial com recibos verificáveis | Retoma somente sufixo ainda não criado |
| Pending incerto | Revisão manual, sem repetir criação nem adoção por semelhança |
| Pacote/armazenamento indisponível | Estado seguro; editor continua funcionando |

Pacote: 11 artigos, quatro categorias, quatro tags, oito menus, quatro plugins,
um template, sete módulos e configuração — 40 registros. A hierarquia de tags e
menus é resolvida pelos IDs retornados pelos creates, não por números fixos.
JPEGs originais (12) incluídos com bytes/hashes/créditos; carregamento verifica
MIME, integridade e tamanho antes de oferecer a instalação. Reprodução do gerador:

```sh
node scripts/generate-joomla-sampledata.js --check
```

Fonte Joomla `52559589cb6a02c9e2fc48270f92b3aff7b8b7a0`, PHP/INI/base SQL.
Textos GPL-2.0-or-later, (C) Open Source Matters; não se afirma instalação
integral do Joomla PHP, nem direitos universais sobre toda mídia/adaptação.

## Diário, concorrência e falhas

O host injeta localStorage e Web Locks quando disponíveis. O diário privado
é separado por site/pacote, contém assinatura e recibos ID/ETag. Não apagar ou
exportar o diário para forçar nova instalação. Limite 512 KiB e confirmação de
persistência; indisponibilidade/quota/corrupção bloqueiam instalação.

Lock é aplicado pelo engine, não só pelo botão. Web Locks coordena abas do
mesmo browser; fallback coordena apenas objetos/realm locais. **Não é trava
entre usuários, browsers ou listas SharePoint.** Restrição de alias/key e
rechecks não equivalem a transação multi-lista. A existência de conteúdo novo
ou uma falha parcial deve interromper, não produzir retry ou rollback automático.

Abandonar a tela impede novas operações. Escrita já iniciada pode concluir;
pending durável exige reconciliação quando não houve recibo confirmado.
Não há exclusão, sobrescrita de conteúdo ou rollback de instalação nesta API.

## Reconhecimento da carga já aceita

Para preservar assinatura, URLs e retomada, o host deve receber explicitamente
as raízes do dataset instalado em `CONFIG.sampleData`:

```js
sampleData: {
  releaseBase: '/sites/example/SiteAssets/minijoomla/releases/0.8.0',
  mediaBase: '/sites/example/SiteAssets/minijoomla/sampledata/original-package'
}
```

Os valores reais são configuração privada do publicador, não defaults deste
documento. Sem configuração, instalação nova usa assets da release corrente.
Trocar release do painel não regrava templates nem deve mudar assinatura de uma
instalação parcial. Customizações legítimas podem produzir estado blocked;
reconhecimento nunca deve ser relaxado para sobrescrevê-las.

## Validação e próximos gates

A regressão integrada passou **79 suítes, zero skips/falhas**, com child
standalone completo e dez skips esperados somente na ausência de SPMIDDLE.
34 testes do engine e regressões de journal/UI/pacote original, confirmação,
concorrência, navegação, pending incerto, singleton e schema passaram.
Syntax check conferiu 258 JS em src/tests/examples; scripts são conferidos à
parte. Stage all foi gerado e validou fechamento; counts são fotografias locais.

Prévia local FIORI-AUTO concluída em 320/768/1366/1920: página Dados de exemplo
pronta sem overflow horizontal. Enter nativo confiável acionou o botão e criou
os 40 registros **somente em repositórios em memória**; segunda instalação
manteve a contagem. Confirmação do navegador foi substituída por double local,
portanto não é aceite do diálogo nativo nem do consentimento real no SharePoint.
Todos os 12 JPEGs foram servidos/validados antes da instalação. A nova leitura
em streaming cancela corpo que ultrapassa o tamanho declarado antes do hash.
Browser e servidor de fixture próprios encerrados após o teste; relatório em
`tmp/step1-native/report.json`. Nenhuma escrita no tenant nesta frente.

Próximos gates: revisão final dos deltas e confirmação nativa real,
preparação de release nova congelada e validação no host existente sem gravar
os 40 registros novamente. Instalação real em domínio vazio não está aprovada
por Node. Não limpar o site para testar o botão; usar teste isolado autorizado.
Publicação, commit/push e integração na principal seguem ações separadas.
