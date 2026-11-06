# Publicacao do fluxo XML no SharePoint

Data: 2026-11-05. Autorizacao: pedido expresso do usuario para publicar e
realizar o aceite. Destino de producao pessoal:
`https://rinaldops.sharepoint.com/sites/camap-agp`.

## Publicado

- MiniJoomla **0.6.0**, fonte de runtime `e869f3c`, SPMIDDLE `b8e9c1e`,
  em `SiteAssets/minijoomla/releases/0.6.0`.
- `SitePages/MiniJoomla.aspx` e `SitePages/Administrator.aspx` com esse loader;
  REST confirmou ambas publicadas (`Level=1`).
- Piloto **corpmessage 0.1.1** em
  `SiteAssets/minijoomla/packages/camap/0.1.1`: XML, entrypoint canonico,
  codigo/helper, CSS, inventario SHA-256 e configuracao confiavel do host.
- Um candidato em `#/extensions/discover`, com acao **Registrar**.
  Nenhum registro, habilitacao ou instancia criado automaticamente.

A release anterior era 0.5.1, fonte `32435a8`, ancestral desta entrega.
Melhorias posteriores ainda locais da worktree02 nao foram integradas nem
publicadas; a outra worktree nao foi alterada. Nao houve push ou merge em main.

## Verificado

1. FIORI-AUTO .NET 9 exclusivo, RPC 47186/CDP 9246 e perfil proprio.
   Origem e web confirmados antes das escritas; nenhum cookie/token copiado.
2. Baseline das oito listas: 36 itens, sem Key vazia ou duplicada; apenas dois
   plugins nativos cadastrados e nenhum manifesto JSON legado em conflito.
3. O campo Key era Text, sem indice/unicidade. Somente esse campo foi alterado
   para `Indexed=true` e `EnforceUniqueValues=true`; releitura confirmou.
   A API de campo nao expunha ETag: foram conferidos GUIDs e SchemaXml antes
   da alteracao. A constraint e aplicada atomicamente pelo SharePoint, sem
   excluir/deduplicar itens. Nao foi executado provisionamento geral.
4. Nove arquivos do pacote enviados sem sobrescrita, com releitura de SHA-256,
   tamanho e MIME, sem divergencias.
5. Runtime preparado com `--skip-provision --prepare-only` e origem HTTPS
   esperada. 202 arquivos enviados e verificados; segunda leitura independente
   dos 202 confirmou hashes/tamanhos e MIME JS/CSS sem falhas. O inventario do
   staging declara 198; seu proprio JSON e tres arquivos de host completam 202.
6. Servico real da nova release executado sobre o pacote remoto: busca completa,
   um candidato ready, parametros message/textarea, author/text, align/select;
   scan sem importar JS/CSS e verificacao posterior dos bytes aprovada.
7. Snapshots das duas paginas salvos antes da primeira alteracao, com ETags
   exatos. O SharePoint normalizou a serializacao HTML; a comparacao textual
   inicial interrompeu a segunda pagina. A comparacao de DOM/atributos/JSON
   comprovou equivalencia semantica. A primeira nao foi regravada; a segunda
   foi publicada mantendo o ETag original. Ambas tiveram releitura final.
8. Reload real do site e painel: uma raiz por aplicativo, somente recursos
   MiniJoomla 0.6.0 e nenhuma resposta HTTP >=400 observada nesses recursos.
   Descoberta exibiu corpmessage 0.1.1 uma vez, sem erros nem CSS antecipado.
9. Painel em 1366x900 e 390x844: botao visivel/focavel e sem overflow no
   container MiniJoomla. Nao e aceite assistivo nem certificacao do shell
   responsivo nativo do SharePoint.
10. Releitura final das oito listas: hashes e contagens dos 36 itens identicos.
    Nenhuma gravacao editorial, de instancia ou registro de extensao.

## Aceite pendente

Abrir `SitePages/Administrator.aspx#/extensions/discover` e usar Registrar no
**CAMAP Corporate Message**. O registro deve nascer desabilitado. Habilitar,
criar/configurar e publicar instancia sao acoes posteriores distintas.
Seguir I6 do plano para escrita/releitura, concorrencia, atualizar e reverter.
Esses testes de lifecycle nao foram executados nesta publicacao.

Somente o piloto foi publicado. Os demais dez modulos e novos perfis XML de
plugins/templates nao foram migrados. Nao se declara equivalencia integral
ao Joomla, aceite completo ou preparacao open source concluida.

## Evidencias e rollback

Evidencias ignoradas em `tmp/acceptance/`: inventario, baseline antes/depois,
constraint, assets, snapshots, equivalencia de canvas, ativacao, smoke e imagens.
Canvases anteriores tambem em `tmp/deploy/0.6.0/rollback-MiniJoomla.aspx.html`
e `tmp/deploy/0.6.0/rollback-Administrator.aspx.html`.

Rollback de implantacao: reler canvas/ETag atuais, conferir MSE ainda em 0.6.0,
restaurar somente seu script para o loader 0.5.1, publicar e reler as paginas.
Preservar outras edicoes; nao substituir canvas inteiro por snapshot antigo
se houver concorrencia. Releases e pacotes anteriores permanecem intactos.

A constraint de unicidade pode permanecer com o runtime anterior. Nao a
desativar automaticamente. Se o aceite criar registros/instancias, sua reversao
exige analise propria e ETags atuais, nao restauracao massiva da baseline.
