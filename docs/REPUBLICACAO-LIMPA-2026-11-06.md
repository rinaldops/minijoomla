# Republicação limpa — 06/11/2026

## Decisão e resultado

Após rejeitar a reconstrução 0.7.0, o responsável solicitou a sequência:
reciclar todos os itens de todas as listas `Mini*`/`Teste*`; excluir essas listas;
excluir `SiteAssets/hh-web` e `SiteAssets/minijoomla`; recriar a publicação
MINIJOOMLA com listas e recursos novos. **Esta operação substitui o estado da
rodada anterior**, sem descartar fontes/alterações locais ou reescrever Git.

**Resultado remoto verificado:** release **0.8.0** ativa nas páginas pública e
administrativa do site corporativo autorizado. Oito listas canônicas novas,
**zero itens**, nenhuma lista `Teste*`. Pasta `hh-web` ausente e apenas 0.8.0 em
`minijoomla/releases`. Dados/configuração/IDs da instalação rejeitada não foram
restaurados. Não foi aplicado seed antigo nem novo seed como efeito implícito.

## Sequência efetivamente executada

1. Inventário autenticado: **16 listas / 79 itens**, ETags por item e snapshots
   privados de schema/dados/canvas. Nenhum anexo nos itens inventariados.
2. **79 itens movidos para a lixeira**; listas relidas vazias.
3. **16 listas excluídas** por IDs/ETags específicos; ausência conferida.
4. Pastas solicitadas inventariadas: **1.214 arquivos / 705 pastas**, incluindo
   as duas raízes. Reciclar/excluir raiz não vazia retornou HTTP 500. O diagnóstico
   do SharePoint exigiu excluir todos os itens internos antes da pasta.
5. Arquivos removidos somente dentro dessas duas raízes; subpastas e raízes
   excluídas de baixo para cima. Releitura confirmou zero listas correspondentes
   e ausência de ambas as pastas **antes da recriação**. Não recriar hh-web como
   recurso de outro projeto nem excluir seus fontes/listas fora do escopo.
6. **Todas as oito listas** recriadas, inclusive templates. Conferidos tipos,
   Required, Choices, defaults e índices/unicidade declarados. Campo textual
   editorial `Author0` explícito; Title nativo reaproveitado sem `Title0`.
7. Pastas/release novas, upload sem overwrite, releitura independente de
   SHA-256/bytes/MIME de **220 arquivos / 3.171.123 bytes**, incluindo host e
   manifesto operacional.
8. Prévia em quatro larguras (320/768/1366/1920) validou rotas e consumo das
   listas realmente vazias. Nenhuma gravação editorial na prévia.
9. Canvas/ETags atuais das duas páginas, patch seletivo de script/scriptCode,
   preservação semântica de outras propriedades/webparts, publicação e releitura.
10. Reload: uma raiz por app, **81/94 recursos** admin/público, nenhuma resposta
    HTTP >=400 e nenhuma versão antiga nos recursos MINIJOOMLA observados.
    Verificação final: oito listas novas vazias, hh-web ausente, somente 0.8.0.

## Fonte: não reutilizar a entrega rejeitada

- Fonte exportada por `git show` da importação **`0bd5de1`**, byte a byte, para
  snapshot isolado em tmp. As 197 fontes originais coincidem com a última revisão
  de fontes do agregador `81dd95e`, posterior ao runtime histórico `e869f3c`.
- SPMIDDLE atual **`14f5e6d`**, copiado com hashes, sem alterar o projeto irmão.
- **196 de 197 fontes próprias permanecem idênticas** à importação. Única
  correção de schema no snapshot: declarar `Author0: Text`, como já esperado pelo
  mapper importado, evitando colisão com o Author de sistema do SharePoint.
- Snippet complementar corrigido somente para o caminho reorganizado
  `libraries/minijoomla/composition/mountMiniJoomlaSite.js`. Host original usado,
  com configuração nova limitada aos novos IDs de listas e raiz de recursos.
- Patches locais de consultas, plugins administrativos e prévia de migração da
  rodada 0.7.0 **não foram incorporados** à 0.8.0. Não foram revertidos no disco;
  continuam separados para futura decisão/revisão.
- Configuração persistida, templates cadastrados, módulos/instâncias e conteúdo
  da instalação anterior **não foram reaproveitados**. Catálogos/listas vazios
  não são igualados a uma instalação com Joomla Blog Sample Data.

## Limites e recuperação

- A referência pessoal informada para `/teams/SAPScripting` não pôde ser
  inspecionada por REST (404). A equivalência exata da sua configuração/dados
  não foi comprovada; **fonte importada limpa** não significa réplica observada
  dessa instalação. O endereço pessoal histórico dos documentos é outro.
- Instalação final deliberadamente sem dados salvos: defaults nativos do código,
  sem restaurar itens reciclados. Seed Joomla/reprodução de configuração só em
  etapa explícita, com relações verificadas; não importar snapshots antigos.
- Testes locais da rodada anterior (77 passes) não são aceites novos da 0.8.0.
  Snapshot limpo passou sintaxe/22 XML/fechamento/determinismo; prévia e reload
  acima são os aceites observados desta publicação.
- Zoom, leitor de tela, mídia, teclado integral e escrita editorial/upload não
  são comprovados por essa publicação; novos perfis XML de plugins/templates
  e executor de migração continuam pendentes conforme escopo aprovado.
- Exclusão de pastas/versões anteriores foi autorizada expressamente nesta
  sequência. **Rollback por simples pointer antigo deixou de ser possível.**
  Não reativar um loader para pasta/lista excluída. Snapshot privado de registros
  e recibos de reciclagem dos itens existem; recuperação completa de recursos
  depende de nova publicação/restauração verificada, não foi testada.
- Atomicidade de Publish frente a edição concorrente não foi demonstrada;
  ETag protege MERGE e releituras protegem o escopo, não uma transação cross-page.
- Nenhum segredo/dado corporativo/GUID/canvas/estado de sessão foi incluído neste
  relatório. Artefatos operacionais em `tmp/clean-republish-20261106/` e snapshot
  de fontes em `tmp/clean-source-agent-20261106/`, ignorados pelo Git.
- Nenhum commit/push ou exclusão de arquivos locais do usuário nesta operação.

## Confirmação e versionamento posteriores

O responsável confirmou o funcionamento tanto do frontpage quanto do painel
e autorizou commit/push e, **depois**, população das listas com Joomla Sample
Data. O commit da publicação abrange os acertos de schema/snippet, comentário
do mapper, fixture correspondente e registros de publicação/compatibilidade.
Patches locais não presentes na 0.8.0 ficam fora do commit dessa publicação;
não se declara que toda a árvore de trabalho corresponde à release ativa.
População posterior deve ler os dados da referência original, materializar
novos IDs e relações e não restaurar itens reciclados ou snapshots antigos.
