# MINIJOOMLA — contrato de instalação genérica SharePoint

> **Desenvolvimento posterior:** bootstrap, engine/port e UI de primeira
> instalação implementados localmente. Primeiro incremento: 106 suítes locais
> e UI nativa em memória aprovadas. A continuidade dos ajustes iniciais e o host
> exato do pacote passam por novos testes; **aceite real no SharePoint pendente**.
> [Primeiro ciclo](CICLO-GENERALIZACAO-INSTALACAO.md) e
> [continuidade após instalar](CICLO-INSTALACAO-CONTINUIDADE.md).

Continuidade: host exato do pacote passou em contratos offline para subsite/raiz,
primeira configuração preservada e UI em memória retestada. Regressão atual:
109 suítes aprovadas, 333 JS/MJS verificados. O limite de aceite real permanece.

## Objetivo do produto

MINIJOOMLA é um CMS genérico Joomla-like. O núcleo não deve depender de TD,
Videoteca, Forum, serviços corporativos, catálogo de extensões CAMAP ou de um
site específico. Site público usa **Cassiopeia** e administração usa **Atum**.
Dados, parâmetros desconhecidos, ETags e decisões do administrador devem ser
preservados. Não se promete executar PHP ou reproduzir todo Joomla/ACL/SQL.

## Fluxo obrigatório da instalação definitiva

1. O desenvolvedor copia fielmente o **pacote distribuível** do MINIJOOMLA para
   o SharePoint. Isso significa os arquivos/fontes/assets do pacote, não `.git`,
   `tmp`, snapshots privados, fixtures de testes ou módulos específicos do TD.
2. Disponibiliza duas páginas `.aspx` com a webpart Modern Script Editor:
   uma para o site e outra para o painel administrativo. A MSE carrega o loader
   e identifica seu contêiner; não colar credenciais nem conteúdo de outro site.
3. O painel oferece instalação inicial: inspeciona o destino, explica ações e
   pede confirmação para criar o modelo canônico/configuração nativa. Ausência
   de listas deve abrir o instalador, não ser confundida com instalação concluída
   ou falha genérica do painel.
4. Após instalar, o administrador gerencia o conteúdo e escolhe **separadamente**
   as extensões/templates a instalar. Nenhum pacote específico é registrado,
   habilitado ou selecionado como default automaticamente.
5. Dados de exemplo Joomla são uma opção explícita, distinta da instalação do
   CMS, com confirmação, preservação dos dados existentes e recuperação segura.

O caminho do site, biblioteca e base dos assets são dados de instalação, não
constantes corporativas no núcleo. Novas revisões são imutáveis e usam seus
próprios hashes/assets; migrar o código não publica páginas automaticamente.

## Separação dos projetos

| Material | Responsabilidade |
| --- | --- |
| Núcleo, administração, componentes/módulos/plugins nativos e contratos genéricos | MINIJOOMLA |
| Bootstrap MSE, configuração inicial e instalador genérico do CMS | MINIJOOMLA |
| Sample Data Joomla opcional, seus notices e mídia selecionada | MINIJOOMLA |
| Videoteca/Forum, seus testes, preparadores e evidências específicas | TD |
| Template corporativo definitivo | `web-devs/CAMAP-V3` |
| Templates CAMAP atuais | Referência transitória; nunca requisito da instalação padrão |

## Templates CAMAP — exceção temporária expressa

Os templates CAMAP-AGO e demais templates CAMAP que existirem no MINIJOOMLA servem
somente de referência para o template definitivo desenvolvido em **CAMAP-V3**.
Não instalar ou selecionar esses templates durante a instalação genérica.
Depois que o template definitivo estiver pronto e validado, retirar as referências
CAMAP do pacote MINIJOOMLA, removendo também dependências/seleções/tests exclusivos
com verificação. O pacote padrão ficará somente com os templates Joomla-like.

A retirada futura não autoriza apagar agora trabalho concorrente ou trocar o
template/configuração de sites existentes. Um administrador pode instalar o
template definitivo como extensão externa; seu código continua separado do núcleo.

## Estado verificável — contrato versus implementação

O projeto já tem administração, módulos/funcionalidades nativos, lifecycle de
extensões, perfil XML de módulos e instalador de dados de exemplo. **O instalador
inicial do CMS vazio a partir somente das duas páginas MSE ainda precisa ser
validado em SharePoint/MSE; seu bootstrap, engine/port e UI já foram implementados
localmente.** O script de implantação antigo provisiona listas
via tooling; isso não comprova que a instalação inicial possa ser feita pela UI.
Da mesma forma, XML de plugins/templates e migração assistida têm gates próprios.

Lacunas de instalação identificadas na auditoria:

- `host.js` depende de configuração gerada pelo deploy (`webUrl`, mapa de listas,
  biblioteca/raízes). Com listas ausentes, a composição/dashboard não chega a um
  wizard de provisionamento. O bootstrap inicial precisa ser independente deles.
- `#/installer` gerencia extensões e `#/sampledata` instala a amostra; nenhum
  deles provisiona as oito listas a partir das duas páginas MSE.
- Uma configuração nativa inicial já conta como conteúdo para o guard do Sample
  Data, que exige domínios vazios. Definir convivência explícita com a instalação
  inicial, mantendo criação apenas/adaptação confirmada e ETags; não afrouxar o
  guard para sobrescrever configuração/conteúdo do usuário.
- Defaults ainda assumem a categoria `noticias`, até em validações de home
  featured sem categoria. A instalação genérica vazia precisa de defaults próprios,
  distintos dos exemplos/demo e da configuração já salva de sites existentes.
- O pacote copiável deve inventariar bootstrap/loader/admin snippet e assets de
  integração; o target core atual não é o pacote SharePoint completo instalável.
- Verificar tipos, required/choices/defaults e unicidade real de Key; criação de
  listas ou `verify()` superficial não é certificado de infraestrutura pronta.

Essa lista registra a auditoria antes do primeiro incremento: várias correções
já existem localmente, mas a validação no destino real continua pendente. A transferência
para TD não os implementa, não provisiona sites nem altera listas atuais.

Preparadores/catálogos de adaptações externas que ainda estejam no repositório
são ferramentas históricas de referência, não entrada da instalação nativa.
O recorte distribuível genérico não deve incluí-los como extensões obrigatórias.
O núcleo pode manter APIs genéricas de extensão, mas não um fluxo que desenvolva
ou pré-instale módulos TD como requisito. A retirada física de bundles históricos
deve preservar hashes e dados operacionais, sem editar inventários imutáveis.

## Validação desta separação

Os dois arquivos parciais e o documento do ciclo Videoteca foram transferidos
para `TD/scripts/minijoomla-reference`, `TD/tests/minijoomla-reference` e
`TD/docs/minijoomla-reference`, com hashes de transferência e ajuste posterior
apenas dos caminhos. Fixtures/pins continuam pendentes; não foram completados
nem executados como extensão. Nenhuma implementação ativa de Forum foi encontrada
no núcleo. Não foram alterados CAMAP2, mse-platform ou sites SharePoint.

Regressão local após separar a seleção: **101 suítes aprovadas, zero skips/falhas**;
syntax check 318 JS/MJS. A suíte genérica recusa implementações específicas TD
na pasta/seleção ativa, mantendo Cassiopeia/default nativo e o gate de instalação
UI explícito. Isso valida a separação técnica, não os passos de primeira instalação
no site ainda não aceitos. Arquivos históricos mistos são tratados por
unidade de pacote, não pela remoção de payloads isolados.

Este documento fixa o fluxo exigido pelo usuário, não anuncia ausência de gates
nem transforma o botão de Sample Data em instalador do CMS. Antes da entrega,
executar Desenvolvimento → Teste no site → Análise → Validação → Documentação em
destino vazio autorizado, sem reinstalar ou regravar a instalação atualmente aceita.
