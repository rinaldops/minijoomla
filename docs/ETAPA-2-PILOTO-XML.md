# Etapa 2 — piloto XML e preparação individual de módulos

> **Resultado vigente:** runtime 0.10.0 ativado e relido, 242 assets conferidos,
> piloto com ciclo real de serviço/instância aprovado e dez módulos preparados
> offline. Os 40 registros originais/ETags permanecem intactos; há dois registros
> adicionais deliberados do piloto (42 no total). **Aceite integral ainda aberto**:
> confirmação nativa, ciclo inteiro pela UI e estado final de publicação da página
> pública. Ela passou a rascunho depois da ativação, sem diferença no canvas;
> nenhuma republicação concorrente/limpeza foi feita. Administrador publicado.

## Base e limites

Frente isolada em `MINIJOOMLA-worktree02`, branch
`feat/joomla-finalization-step2`, baseada em `2ae9443` (etapa 1 publicada 0.9.0).
Não reintegrar patches da principal, não limpar listas e não modificar a amostra
de 40 registros. Somente registro/instância novos do piloto podem ser criados
no aceite explícito do ciclo; as outras dez extensões permanecem preparação.

Piloto: `camap.mod_camap_corpmessage`, revisões **0.2.0 e 0.2.1**, três parâmetros
reais: message/textarea, author/text, align/select (left/center/right). Estado
inicial desabilitado, habilitação e criação de instância separadas. XML/inventário
não executam JS nem CSS durante descoberta.

## Preparação e fontes

O gerador CAMAP2 existente foi usado sem alterar o projeto. Dependências
`es-module-lexer` e `css-tree` ausentes foram instaladas com lock e scripts
desabilitados somente em snapshot sob tmp, usando feed aprovado e TLS normal.
Nenhum `node_modules`, package/lock ou fonte do CAMAP2 foi modificado.

- Dois pacotes reais do piloto gerados em pastas novas imutáveis.
- Import/render local dos entrypoints reais, schema XML e integridade aprovados.
- Instalação local desabilitada, atualização/reversão e guarda de dependência
  exercitadas; settings desconhecidos/IDs preservados. Testes locais não são
  aceite de escrita no SharePoint.
- Os dois pacotes foram publicados em pastas novas do destino autorizado;
  dez arquivos por pasta (oito payloads + inventário/configuração), hash/bytes/
  MIME verificados. Sem instalação/habilitação/instância automática pelo upload.
- Serviço de descoberta efetivo da 0.9.0 consultou e verificou ambos os pacotes
  remotos, com zero writes/imports; contratos de parâmetros idênticos.

`scripts/prepare-module-adoption.js` prepara **um módulo por pacote**. Os dez
módulos não pilotos foram preparados/validados localmente, não migrados nem
publicados. Inventários, schemas/defaults, grafo JS/CSS e verificação pelo
runtime aprovados; ver [contrato de preparação](MODULE-ADOPTION.md).

## Correções antes do ciclo real

Configuração do host 0.9.0 não contém raízes XML. Conectar o piloto exige uma
**nova release de host/runtime**, não sobrescrever 0.9.0. Cada entrypoint deve
ter vínculo de CSS exato comparado ao descritor verificado; revisão anterior
mantida aprovada para rollback e sem descoberta conflitante.

- `assertJoomlaPackageAssets` rejeita mapa ausente, CSS de outra revisão e
  duplicatas. Aprovação depende de descritores realmente verificados, não
  objetos fornecidos pelo DOM. Preflight do publicador consulta essa guarda.
- Instâncias com settings persistidos `[]`, `null` ou número devem bloquear
  upgrade e rollback antes de qualquer escrita; instâncias desabilitadas/lixeira
  também contam.
- Serialização direta de objetos de configuração aceita somente JSON próprio,
  não executa getters/toJSON; não confundir string numérica conservada por
  contrato histórico com promessa de normalização automática do input direto.
- Preparador compara schema/defaults dos exports nomeados ao default consumido
  pelo runtime, sem adicionar módulos ao core genérico.

## Roteiro de aceite real e registro

1. Inventário inicial: 0.9.0 efetiva, páginas publicadas/sem checkout, oito listas
   com os 40 registros, piloto ausente e Key realmente Text/Indexed/Unique.
   Backups/canvas/ETags/IDs ficam em tmp privado; nenhuma constraint alterada.
2. Nova configuração aprova raízes das duas revisões e CSS por entrypoint;
   primeira revisão descoberta para instalar; revisionamento/configuração devem
   ter diário e rollback da 0.9.0.
3. Pelo painel, confirmar Registrar; reler extensão desabilitada e capturar ETag.
   Habilitar explicitamente, reler. Criar uma instância do piloto em posição
   real suportada, com conteúdo/autor/alinhamento e escopo delimitados.
4. Editar os três parâmetros pelo formulário, aceitar retorno 204 por releitura
   GET, verificar resultado e ETag. Invalid alignment/stale ETag não gravam.
5. Verificar render real com escaping/multilinha/alinhamento, JS/helper/CSS
   correto/deduplicado e navegação. Desabilitar/reativar extensão e instância
   separadamente, sem conteúdo/CSS residual.
6. Atualizar para 0.2.1 e reverter para 0.2.0, mantendo ID/key/state da extensão
   e **bytes/ETag/atribuições/settings de todas as instâncias**. Contrato de
   parâmetros diferente permanece bloqueado, sem migrar automaticamente.
7. Remoção com instância deve recusar. Não remover automaticamente registros do
   usuário depois do teste nem reexecutar mutation incerta. Registrar recibos por
   ação e comprovar preservação dos 40 itens originais independentemente.
8. Só após esse gate preparar adoção individual real dos dez restantes. O limite
   de dez raízes inclui revisões retidas; não concatenar onze configurações.

Instância de demonstração do piloto é recurso adicional deliberado, não
reinstalação de Sample Data nem substituição de conteúdo existente. Sample Data
pode passar a identificar conteúdo diferente pelo novo registro: deve bloquear
reinstalação, não apagar o piloto para parecer uma amostra exata.

## Pendências que não são fechadas por preparação

Aceite real completo do piloto e reconciliação de publicação concorrente,
implantação individual das dez extensões, novos perfis XML de plugins/templates e executor
assistido. Fórum/videoteca/documentation são módulos de apresentação no perfil
atual, não serviços completos de backend/streams/interação.
i18n, SEO do host, histórico editorial e check-in/check-out continuam excluídos.
Privacidade/direitos/fontes correspondentes dos terceiros e aceite assistivo
integral são gates independentes, não garantidos por hashes ou upload.

## Execução remota e limites observados

### Publicação e preservação

- Pacote imutável 0.10.0: **242 arquivos / 4.138.275 bytes**, incluindo manifesto operacional,
  host/loader/CSS escopado. Upload creation-only e releitura independente de
  SHA-256/bytes/MIME aprovados; 0.8.0/0.9.0 não sobrescritas.
- Prévia read-only em 320/768/769/900/1366/1920/2560 px: rotas administrativas e
  públicas, XML real com schema correto, vínculos CSS e Sample Data instalado
  passaram; zero escritas remotas/diário. Não é aceite completo de acessibilidade.
- Ativação seletiva nas duas páginas usou canvas/ETags recém-capturados, preservou
  outras propriedades/webparts e confirmou ambas publicadas/sem checkout no
  instante do write. Rollback para 0.9.0 preparado, não executado.
- Reload final: editor TinyMCE único, abas/cleanup, quatro plugins, imagens e
  hierarquia do menu preservados; 165/103 recursos administrativos/públicos na
  janela observada, sem HTTP >=400 de assets. Sample Data permaneceu bloqueado
  no site populado, sem tentativa de reinstalação sobre o novo piloto.
- Inventário independente pós-ciclo: oito listas canônicas, **42 registros**;
  comparação integral dos 40 originais (incluindo ETags) passou após upload,
  antes da ativação e após o ciclo. Nenhum artigo, categoria, tag, menu, plugin,
  template, SiteConfig ou instância original foi gravado.

### Piloto efetivamente exercitado

| Ação | Evidência real | Limite |
| --- | --- | --- |
| Descobrir/verificar | Serviço efetivo leu XML/inventários de duas raízes; nenhuma execução de assets no scan | Não libera PHP/plugins/templates |
| Registrar desabilitado | Create 201, um registro, nenhuma instância automática; Key Text/Indexed/Unique relida do alvo | Feito pelo serviço, não confirmação nativa do botão |
| Habilitar | Update 204 seguido de GET/novo ETag | Feito pelo serviço |
| Criar instância | Formulário da 0.10.0 com campos XML, posição `main-top`, escopo All, Enter do FIORI-AUTO; releitura | Um recurso novo de demonstração, não Sample Data |
| Editar | Três parâmetros editados no formulário, Enter, releitura confirmou conteúdo/autor/align e novo ETag | Não cobre save/upload editorial de artigos |
| Conflito/validação | Write com ETag capturada anterior recebeu **412**, registro permaneceu idêntico; align inválido recusado antes do write | Negativos pelo serviço; mensagem da UI em conflito ainda não aceita |
| Render/CSS | DOM real escapado, multilinha, autor/right, CSS único e helper/JS da revisão exata | Screenshot privada obtida, não analisável por esta sessão |
| Atualizar/reverter | Serviço 0.2.0 → 0.2.1 → 0.2.0, cada 204 relido; site carregou assets correspondentes, instâncias/settings/ETags preservados | Upgrade pelo painel não executado; raiz 0.2.1 aprovada mas `discover:false` no host ativo |
| Desativar/reativar | Extensão e instância separadamente: ausência de render/CSS, retorno correto após reativação | Estados finais habilitados |
| Remoção | Instância relacionada bloqueou remoção com zero writes | Nenhum registro/asset removido para encerrar teste |

O site permanece com o piloto **habilitado em 0.2.0**, com uma instância de
mensagem editada em `main-top`. Não foi adotado/apagado registro preexistente.
Após rollback a tela de descoberta pode ficar sem ação, pois a única raiz
descoberta é 0.2.0; a atualização futura via UI exige configuração imutável nova
que descubra 0.2.1 mantendo 0.2.0 aprovada para reversão.

### Releituras e contraprovas

1. Primeira tentativa de habilitação recusou **antes do write** porque o recibo
   JSON havia omitido `etag` não enumerável do repository. Releitura independente
   conciliou ID/key/state/ETag com REST; snapshots privados passaram a transportar
   ETag explicitamente. A nova habilitação só ocorreu após essa conciliação,
   sem repetir create ou modificar middleware/runtime.
2. Primeira inspeção pública consultou o DOM cedo e depois procurou o helper na
   pasta errada. Espera limitada por conteúdo efetivo e caminho real de
   `libraries/camap/extensions/camap/_shared/` corrigiram o teste; a contraprova
   passou sem alteração de assets/dados do aplicativo.
3. Última checagem exigindo ambas páginas publicadas falhou: página pública com
   **Level=2 (rascunho), CheckOutType=2**, ETag diferente do recibo de ativação,
   canvas semanticamente idêntico. Administrador com Level=1 e mesmo ETag. A
   causa não foi atribuída ao app/terceiros sem prova; nenhum Publish automático,
   canvas antigo ou ETag antiga foi aplicado sobre o estado concorrente. O
   inventário reconciliado distingue dados/runtime aprovados de
   `bothPagesPublished=false`. O fechamento de publicação segue bloqueado.

Backups, hashes, configuração/identificadores, intents, releituras, screenshots e
contraprovas ficam somente em `tmp/step2/` ignorado. Nunca transportar tokens,
cookies ou detalhes da autenticação para o repositório.

## Regressão e revisão

**Regressão final: 82 suítes aprovadas, zero skips/falhas**; sintaxe de 262 arquivos
JS aprovada e `git diff --check` sem erros. SPMIDDLE opcional explicitamente marcado em 11 suítes.
Checkout standalone executou 70 suítes locais/11 skips esperados (o runner que
cria o próprio child fica fora desse child). Suíte de lifecycle usa composição,
mapper/repository/list-client reais com REST/DOM doubles, pacote real ancorado
por hashes e `204/null → GET`; não substitui evidência remota ou teclado real.

Revisão independente confirmou integridade dos 242 payloads congelados e fixes
de JSON/installer, sem blocker específico ao piloto. Identificou lacunas genéricas
no preparador (default runtime ausente/divergente) e na guarda de CSS (ordem da
cascata). O piloto tem defaults idênticos e um único CSS por revisão, portanto
não afetado. **As duas lacunas foram corrigidas e testadas localmente**: settings
reais obrigatórios/defaults consistentes e ordem CSS fiel ao XML. Auditoria dos
12 pacotes/revisões existentes passou novamente sem reconstruir/alterar assets.
Esse hardening posterior não integra o snapshot 0.10.0: o preparador não é
distribuído no runtime e a guarda embarcada nessa release é a variante anterior
que compara CSS sem considerar ordem. O publicador local já usa a guarda nova;
uma futura release deve incluí-la, sem sobrescrever a 0.10.0.
Reempacotamento de contraprova local confirmou 48 fontes `libraries/minijoomla`
idênticas ao snapshot publicado e uma única diferença posterior: a guarda CSS
citada. O manifesto operacional congelado é a referência de bytes da 0.10.0;
HEAD posterior não é, por si só, sua reprodução byte-a-byte.

Integração de branches na principal permanece pendente: sua árvore suja foi
preservada e não foi absorvida. Não declarar conclusão integral do plano ou
distribuição pública pronta com estes passes.
