# Execucao da compatibilidade de extensoes Joomla

> Atualizacao apos autorizacao expressa: runtime 0.6.0 e piloto corpmessage
> 0.1.1 publicados no SharePoint pessoal. Carregamento/descoberta remotos
> verificados, dados preservados; aceite de escrita/lifecycle ainda pendente.
> Ver [registro de publicacao](PUBLICACAO-JOOMLA-XML-0.6.0.md). O relato abaixo
> descreve a etapa local anterior e os gates existentes naquela etapa.

## Isolamento e escopo

Data: 2026-11-05. Worktree: `C:\projetos\vsto\web-devs-worktree03`.
Branch: `feat/joomla-extension-discovery`, baseada em
`ae59d518b2c16ff4c39ea929a249c8f1e9f4a067`. A worktree02, com outra frente
administrativa ativa, nao foi alterada. SPMIDDLE tem branch local propria
`feat/joomla-discovery-files`; suas alteracoes pertencem ao submodulo.

Dois agentes `gpt-6-luna` atuaram em arquivos exclusivos: transporte SPMIDDLE
e empacotamento CAMAP2. Depois revisaram distribuicao e os deltas de dominio.
Integracao, testes, host, runtime e documentacao foram coordenados nesta frente.

## Estado do plano

| Etapa | Estado e evidencia |
| --- | --- |
| I0: baseline/isolamento | Worktree nova, snapshot de origem preservado; identificado problema historico de bytes dos artefatos 0.1.0 |
| I1: manifesto | Perfil de modulos XML implementado com parser real ISC, namespace tipado, parametros normalizados e recusas explicitas |
| I2: arquivos | SPMIDDLE lista pastas/arquivos paginados, limita continuacoes e tamanho, propaga cancelamento e limita leitura binaria em streaming |
| I3: descobrir/instalar | Busca sem imports/escritas, diagnostico de conflitos, fingerprint, inventario aprovado, registro desabilitado e guard de unicidade real |
| I4: piloto | Gerador produz corpmessage com XML/JS canonicos e dependencias fechadas; import/render/CSS reais aprovados localmente |
| I5: ciclo de vida | Upgrade/rollback XML com ETag, settings/IDs preservados, uma revisao anterior, CSS por entrypoint e loader reconciliado |
| I6: host real | Preparado e bloqueado por gates; nao houve upload, escrita de listas, mudanca de constraints nem publicacao no SharePoint |
| I7: ampliacao apos aceite | Gerador consegue preparar os onze modulos, mas nenhum foi migrado no servidor; plugins/templates XML e demais tipos continuam fora do perfil |

O contrato portavel, exemplos e limitacoes estao em
[EXTENSOES-JOOMLA.md](EXTENSOES-JOOMLA.md). O plano original continua em
[PLANO-COMPATIBILIDADE-EXTENSOES-JOOMLA.md](PLANO-COMPATIBILIDADE-EXTENSOES-JOOMLA.md).
Esses dois registros privados de plano/execucao nao integram o contributor.

## Verificacoes locais

- MINIJOOMLA: suite completa com 61 suites aprovadas, zero skips/falhas;
  inclui checkout isolado sem SPMIDDLE e controles negativos de import/runner.
- MINIJOOMLA: sintaxe de 216 arquivos JavaScript aprovada. O publicador `.mjs`
  foi verificado separadamente com `node --check`.
- Distribuicao: staging core/site/all e contributor, grafo de dependencias,
  hashes, licencas, contencao e imutabilidade passam nas suites existentes.
- CAMAP2: 106 testes aprovados; check, validate e verify aprovados. Onze
  extensoes e tres componentes validos; pacote legado novo com 80 arquivos.
- SPMIDDLE: `npm test` completo aprovado, incluindo contratos de transporte,
  arquivos, repositorios, provisionamento e exemplos.
- Pacote XML de todos os onze modulos: 65 arquivos, inventario fixado validado
  pelo servico real de descoberta e imports dos entrypoints canonicos no Node.
- FIORI-AUTO .NET 9: instancia exclusiva RPC 47185/CDP 9245. Navegador local
  verificou descoberta e registro com XML real e portas em memoria, cancelamento,
  estado desabilitado, foco e ausencia de overflow em 1366x900 e 390x844.
- Browser importou o wrapper real de corpmessage e seu helper por HTTP 200;
  verificou escaping, alinhamento, cor calculada do CSS real, deduplicacao de
  link e cleanup. Isso nao equivale a E2E em SharePoint nem aceite assistivo.

Evidencias locais ignoradas: `tmp/joomla-browser-evidence.json`,
`tmp/joomla-runtime-evidence.json` e screenshots `tmp/joomla-*.png`.
Pacotes regeneraveis CAMAP2 em `CAMAP2/tmp/joomla-pilot-0.1.1` e
`CAMAP2/tmp/joomla-all-0.1.1` (caminhos relativos ao agregador).

## Decisoes apos revisao

1. Loader de modulos nao pode conservar JS antigo ao aplicar CSS novo.
   Agora acompanha URL por registry/chave, reconcilia upgrade/rollback,
   reaproveita imports e descarta conclusoes assincronas obsoletas.
2. ETag da extensao nao protege edicoes de instancias em outra lista.
   O ciclo automatico exige o mesmo contrato normalizado de parametros;
   mudancas de schema/defaults requerem migracao assistida. Rotulos e
   descricoes podem mudar. Nao se declara transacao cross-list inexistente.
3. Registros JSON legados nao sao convertidos silenciosamente para XML sem
   rollback verificavel; a UI informa a necessidade de migracao assistida.
4. A declaracao de index unico no schema nao e comprovacao do estado real.
   O guard somente consulta Key e bloqueia a instalacao se nao estiver
   Text/Indexed/EnforceUniqueValues. Nao altera a lista automaticamente.
5. Artefatos antigos 0.1.0 tinham hashes baseados em EOL mistos que nao podem
   ser reconstituidos por uma conversao LF simples. Nao foram sobrescritos
   nem tiveram hashes afrouxados. Foi gerada a versao nova 0.1.1 com LF antes
   do hash, testes CRLF/LF e `.gitattributes` de bytes exatos para `dist/`.
6. O atributo TinyMCE apontava para caminho antigo. Foi corrigido para a pasta
   atual e os arquivos cujo unico desvio era EOL recuperaram exatamente os
   bytes de HEAD; o aviso original voltou a 471 bytes. Codigo/licencas do
   fornecedor e asserts de checksum nao foram modificados.

## Gate pendente no SharePoint

A primeira melhoria nao tem aceite integral enquanto I6 nao estiver concluida.
Nao houve deploy ou migracao automatica nesta execucao. Antes de ativar:

1. Confirmar host/sessao e inventariar dados/assets sem escrita; usar instancia
   propria do FIORI-AUTO e o destino de producao autorizado nesta sessao.
2. Comprovar ou planejar separadamente a unicidade de Key, sem remover dados
   duplicados automaticamente. O provisionador atual nao prova esse indice.
3. Publicar pacotes em raizes novas imutaveis, revisar configuracoes e executar
   preflight de hashes e MIME. O publicador verifica os pacotes antes de escrever
   e recusa ativar o host XML sem a constraint real.
4. Executar o roteiro I6 do plano com escrita/releitura reais: registrar,
   habilitar, configurar/publicar instancia, editar, atualizar, reverter,
   verificar ETags/concorrencia e dependencia de remocao. Validar teclado e
   estados de erro. Nao remover dados existentes para facilitar o teste.
5. Somente apos esse aceite iniciar a migracao dos outros dez modulos e a
   ampliacao de perfis. Retornar loader/configuracao anteriores e manter os
   pacotes originais disponiveis constitui o rollback de implantacao.

Nenhum push, merge em main ou alteracao de ambiente remoto foi executado.
