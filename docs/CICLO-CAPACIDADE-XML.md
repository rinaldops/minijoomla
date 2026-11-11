# Ciclo de capacidade XML — agrupamento finito, sem migração

> **Prova vigente:** agrupamento de dois módulos neutros em duas revisões
> passou em testes locais e no site. **Nenhum módulo de prova instalado ou raiz
> adicionada ao host publicado**; 0.15.0 mantida, oito raízes/48 registros intactos.
> O mecanismo agrupado não libera automaticamente a adoção dos sete externos.

Iniciado em 08/11/2026 após `ae3df33`, na branch isolada
`feat/joomla-finalization-step2`. Baseline do site: 0.15.0, 48 itens e oito
raízes aprovadas. Esses itens, raízes, revisões e mapas CSS devem permanecer
inalterados. Nenhuma instalação em lote ou troca de metadata é autorizada
como efeito do empacotamento.

## Desenvolvimento

Preparar união de dois a sete pacotes **explicitamente selecionados**, com
pins de inventário e fechamento JS/CSS reais. Um grupo mantém vários XML/keys,
um inventário e uma raiz por revisão. Helpers só são deduplicados se os bytes
forem idênticos; colisões divergentes/case, dependências ausentes e paths
inseguros recusados. Avisos/planos individuais não podem sobrescrever-se.

O empacotador produz arquivos novos e uma proposta de configuração; não instala,
habilita ou migra extensões. Mantém limites atuais de dez raízes/500 arquivos/
10 MiB e 64 KiB de inventário. Não move os quatro módulos já adotados.

## Prova planejada no site

Usar **dois módulos neutros de prova**, código próprio mínimo, em duas revisões
agrupadas. Eles não são Hero/Home nem os sete módulos externos pendentes.
Publicar somente os pacotes de prova em raízes novas e testar por portas read-only
da composição, sem alterar configuração persistida/páginas/registros do host.

Conferir descoberta de dois candidatos por raiz, revisão anterior retida,
conflito de descoberta simultânea, integridade de todos os arquivos, CSS por
entrypoint, rejeição da 11ª raiz e preservação dos oito pins atuais. Tamper
simulado somente no retorno da porta de leitura; não corromper arquivos publicados.

## Análise/validação/documentação

Agrupamento só economiza capacidade se o conjunto puder ser revisto e congelado
por inteiro. Verificar um candidato lê o inventário de todo o grupo. Novos
arquivos não podem ser adicionados a uma raiz publicada para acomodar o próximo
módulo. Duas raízes agrupadas menores provam o mecanismo, não a viabilidade
incondicional de todas as sete fontes, seus direitos ou futuras correções.

Este ciclo não aprovará um grupo de módulos externos ainda não desenvolvidos/
testados. Após a prova, documentar medidas/recusas e escolher o próximo passo
de desenvolvimento dentro da sequência individual, sem aumentar limites ou
retirar raízes referenciadas para fabricar capacidade.

Aceites integrais editoriais/assistivos e XML de plugins/templates/migração
assistida permanecem frentes separadas. Distribuição pública não pronta.

## Iteração 1 — desenvolvimento e prova de arquivo

`scripts/prepare-xml-module-group.js` valida dois a sete pacotes individuais por
pins explícitos, parser XML real, inventário completo e grafo JS/CSS. Módulo/
schema/XML/CSS não são reescritos; suas bases são recalculadas para o root novo.
Avisos/planos são copiados integralmente em namespace por membro, sem sobrescrita.
Compartilhamento só deduplica bytes idênticos. Dados próprios desconhecidos dos
planos são preservados como bytes, não executados ou promovidos a aprovação.

As provas usam `mod_capacity_alpha`/`mod_capacity_beta`, código próprio mínimo,
com helper transitivo e **duas folhas CSS em ordem por módulo**. Não são adapters
de Hero/Home, dados ou código dos sete módulos futuros. Agrupador não importa
entrypoints. Import/render próprio só ocorre no ensaio separado explicitamente
identificado. GPL completa acompanha workflow e código próprio, sem atribuir
licença a pacotes alheios. [Contrato do empacotador](AGRUPAMENTO-XML-FINITO.md).

Cada pacote de prova tem **27 arquivos totais/25 inventariados**, 39.940 bytes,
inventário de 5.121 bytes, dentro dos limites. Não desloca raízes/pacotes atuais.

| Revisão de prova | SHA-256 do inventário |
| --- | --- |
| 1.0.0 | `07a8e15206ea34cd3909663db6f046e86851c408c8ad23b7238b5a7720069ec7` |
| 1.0.1 | `e9e8dd9b638aa4874b9fa05267c668b4a7c389a8d55d363fd3fc5dd001affbcd` |

## Teste no site → análise

1. Rebaseline independente confirmou oito roots e quatro módulos XML instalados,
   todos verificáveis contra as revisões aprovadas, com zero writes.
2. Pacotes neutros carregados em pastas novas imutáveis, `overwrite=false`;
   **54 assets** relidos por hash/bytes/MIME. Não houve alteração de páginas ou
   configuration do host, nem registro/habilitação/instância de prova.
3. Serviço efetivo da 0.15.0 consultou dois candidatos na segunda raiz; verificou
   todo o inventário e a revisão anterior retida `discover:false`. Ensaio read-only
   composto preservou oito aprovações e aceitou **8+2=10**; a 11ª foi recusada.
   Essa composição foi somente em memória, não configuração publicada.
4. Duas raízes descobertas simultaneamente produziram conflito de ambas as
   identidades. Falha de diretório simulada marcou scan incompleto. Alteração
   **somente no retorno de uma porta read-only** para um arquivo beta bloqueou
   alpha, comprovando acoplamento da integridade. Nenhum arquivo remoto corrompido.
5. Prova do scan: **184 leituras, zero gravações remotas/zero imports de entrypoint**.
   A verificação individual depende de todo o grupo; problema em um membro pode
   bloquear instalação/reversão de outro. Isso é limite de desenho, não bug ocultado.
6. Painel real em root temporário, catálogo/installer inertes que recusam escrita:
   dois candidatos renderizados, modal nativo aberto com Enter e cancelado com
   Escape do FIORI-AUTO, zero tentativas de registro. Root/app temporários removidos.
7. Ensaio de runtime separado importou **apenas dois entrypoints de código próprio
   de prova**, carregou quatro CSS aprovados, renderizou texto escapado no DOM
   temporário e removeu CSS/root. Zero write/instalação. Não é evidência de runtime
   dos módulos externos não adaptados.
8. Snapshot final comparou **todos os 48 itens/ETags**, zero diferenças; páginas
   permanecem publicadas/sem checkout e apontam à 0.15.0. Editor/abas/cleanup,
   quatro plugins, Sample Data bloqueado, imagens/menu mantidos; 166/115 recursos
   admin/público sem erro de assets na janela observada.

## Iteração 2 — análise independente → novo desenvolvimento

A revisão independente confirmou os dois pacotes OWN byte-exatos e identificou
duas lacunas genéricas, não usadas por seus arquivos: um specifier `.helper.js`
aceito como relativo embora seja bare em JavaScript, e dependências alternativas
que podiam incluir arquivo extensionless sombreando a resolução CJS.

Correções locais antes de validar a ferramenta genérica:

- Exigir import iniciado por `./` ou `../`; um prefixo ponto sozinho não basta.
- Executar os parsers somente a partir de **nova cópia isolada da closure
  aprovada**. Arquivos extras do diretório de dependencies não entram nessa cópia/
  resolução. Input/closure/plano e stage são relidos antes de materializar output.
  Sem relaxar rede/TLS ou importar código de pacote de entrada.
- Acrescentar negativos com parser real para bare-dot e sombreamento de resolução,
  manter os pacotes imutáveis anteriores e repetir reprodução byte-a-byte e
  prova read-only no site. Nenhum inventário de raiz publicada recalculado.

**Contraprovas posteriores aprovadas:** 47 recusas do engine, três negativas
bare-dot com lexer real, shadows extensionless/addon excluídos da cópia de 175
dependencies, metadados de resolução divergentes e alteração do stage recusados.
Prova offline confirmou loader/registry OWN com `render({settings})`, escrita
exclusiva, input/plano intactos e recusa de overwrite. Os dois grupos congelados
reproduziram todos os 27 arquivos, com os mesmos pins e bytes; repetição no site
passou novamente com 184 leituras, zero writes/imports no scan.

As duas lacunas são de tooling local; alterações não exigem publicar runtime
novo nem converter metadata instalada. Prova do agrupamento não resolve ainda o
grupo definitivo dos sete, nem permite adicionar membros a um root congelado.

Primeira fixture do painel faltava `overview`; correção do double read-only e
limpeza do root órfão produziram contraprova aprovada, sem salvar dados. Runner
privado do inventário final também procurou pacote de release inexistente nesta
frente de tooling; caminho corrigido, releitura aprovada. Essas falhas não foram
contadas como passes iniciais nem motivos para repetir uma mutation.
Repetição read-only adicional da preservação foi interrompida pelo encerramento
concorrente da própria instância FIORI-AUTO. Não foi contada como aprovação;
os recibos de preservação final e inventário de 48 itens já estavam aprovados,
e depois deles só ocorreram ensaios sem writes/instalação. Navegador próprio
encerrado; nenhuma operação do site foi repetida por essa falha de transporte.

Recibos brutos/configuração, inputs OWN, pacotes congelados, scripts operacionais
e provas em `tmp/xml-group-cycle/` e `tmp/xml-group-agent-*` ignorados. Não
publicar snapshots ou segredos; artefatos de prova carregados não configuram o host.
Agregação final verificou hashes de 14 recibos aprovados, sem promover a prova
temporária a instalação ou aprovação persistida. Sintaxe de 269 JS aprovada;
primeira regressão integrada passou em **88 suítes, zero skips/falhas**.
**Reexecução após as correções genéricas: 88 aprovadas, zero skips/falhas**;
child standalone com 76 locais/11 skips esperados. Revisão independente
confirmou a correção dos dois bloqueadores e a reprodução dos pacotes OWN;
stage de parser não é sandbox contra processo local concorrente.

## Próximo desenvolvimento: viabilidade real, não expansão fictícia

Mantêm-se **duas vagas reais**. Reservá-las como conceito para grupo finito não
altera as oito aprovações atuais. Os sete futuros só podem usar duas raízes se
seu conjunto de arquivos, dependências, segurança e avisos for desenvolvido/
testado/revisto por inteiro antes de congelar. Correção posterior pode exigir
outra revisão; não prometer capacidade ilimitada.

Continuar o ciclo de **Hero** em ensaio isolado no site, sem consumir novas
aprovações do host ou instalar o conjunto antecipadamente. Apenas depois da
documentação de cada módulo avançar ao próximo. Se os ciclos individuais não
permitirem formar grupo definitivo dentro do teto, registrar o bloqueio e
decidir arquitetura explicitamente; não remover roots referenciados, mover IDs,
apagar dados, alterar JSON próprio ou aumentar cap silenciosamente.

Este fechamento é prova técnica do agrupador/comportamento do perfil atual,
não migração aplicada, suporte XML de plugins/templates ou liberação pública.
