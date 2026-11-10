# Ciclo — destaque nativo com imagem e resumo

## Checkpoint e Desenvolvimento

Templates/posições/parâmetros enviados em `4029c48` na branch step2, remoto
conferido. Este incremento reconcilia o módulo genérico `articles-featured` que
já existia na principal, sem incorporar um template CAMAP-V3 ou código TD.
Principal preservada em nova captura: 68 arquivos / 1.038.354 bytes. Não houve
merge/retirada ou edição das fontes da principal.

Novo tipo nativo selecionável pelo administrador usa `renderArticleCard`:
imagem de introdução, alt/legenda, título, resumo sanitizado, data e link.
`articles-news` permanece a lista de títulos anterior. Limite 1..50, chrome,
estado loading/error/empty e horários de destaque são os contratos nativos.
Gerador de manifestos passa a declarar **16 pacotes nativos**, sem criar
automaticamente instância, extensão, conteúdo ou configuração no mount.

## Análise e correções antes do Teste no site

Revisão independente encontrou um risco de substituição: uma extensão antiga
podia usar a chave `articles-featured`, anteriormente livre. A aplicação não
registra o tipo nativo quando há registro nessa chave; catálogo mantém a origem
e os parâmetros antigos. Colisão surgida depois da montagem exige recarga e
falha segura, não substituição silenciosa. Nenhum registro é apagado/reescrito.

Cards novos agora recebem opções globais de conteúdo e preparação dos plugins.
Preparação é limitada à seleção do novo módulo; expansão de loadmodule/loadposition
fica desativada nessa chamada para impedir recursão, e placeholders são removidos.
Não alterar o pipeline dos módulos antigos por esse incremento.

Achado no renderer de imagens compartilhado: fontes numéricas/booleanas e
`mailto:` podiam ser convertidas em `src`. Agora apenas string de mídia segura
é renderizada; fragments, data/blob/javascript/file e valores não textuais são
omitidos, sem mudar conteúdo persistido nem afrouxar o sanitizador.

## Teste no site → Análise → Validação → Documentação

Prova isolada em iframe próprio na página SharePoint autorizada, via FIORI-AUTO.
Assets de prova em pasta nova imutável: **209 payloads + manifesto**, hashes
readback conferidos. Não substituir release atual ou salvar canvas/páginas.
Catálogo/artigos/instância da prova usam apenas repositories em memória.

Keyboard nativo: abrir configuração, selecionar aba Parâmetros, gravar limite 1,
abrir site de prova, confirmar card único com resumo e imagem realmente carregada
(400 pixels naturais), alt correto, link por Enter e reflow 320/768/900.
Original administrativo preservado; iframe removido/navegador próprio encerrado.
Snapshots antes/depois: **48 registros/ETags, duas páginas e hash do host iguais**,
zero writes nas listas/páginas. Assets de prova são o único material enviado.

Focais: limite/chrome/metadata segura, renderer compartilhado, agenda pelo adapter
real, catálogo/criação explícita, basePath, supressão desabilitada, legado de chave
existente e preparação de plugins. Regressões completas em fechamento; não
transformar esse ensaio em aprovação de instalação real/deploy do núcleo.

Reauditoria posterior identificou filtro de elegibilidade após slicing e gate
de chave maior que o contrato Module. Seletor compartilhado agora filtra antes
de limitar/preparar; somente registro Module nessa chave retém sua origem. Testes
de snapshot com Draft antes de artigo válido e chave igual em Plugin passaram;
teste de `showReadmore:false` inclui corpo não vazio para provar o encaminhamento.

Reteste exigido: revisão nova imutável, mesmos 209 payloads + manifesto,
keyboard/imagem/link/reflow passaram outra vez; snapshot final de registros/ETags,
páginas/host igual à referência inicial. Prova e navegador próprios encerrados.

Validação final: **120 suítes aprovadas, zero skips/falhas**, parse-only **354
JS/MJS**, contributor **448 caminhos exatos** com hashes/inventário/CLI/contenção
aprovados. Nenhuma exceção de vendor/direitos ampliada. Isso fecha este ciclo
funcional, mantendo separado o deploy/instalação real e o merge da principal.

Próximos ciclos: demais deltas nativos/preview da principal e perfis XML de
plugins/templates. Não desenvolver Videoteca/Forum nem retirar CAMAP antes do
template definitivo externo. Trabalho deste incremento posterior ao checkpoint
recebeu autorização posterior de commit/push nesta branch step2, mensagem
`feat: reconcile native featured article cards without replacing registered modules`.
Merge/retirada exigem fechamento próprio; a integração posterior de `FullBleed`
do host MSE/SPMIDDLE não modifica automaticamente as páginas aceitas.
