# MINIJOOMLA

CMS JavaScript modular Joomla-like: site público Cassiopeia e painel administrativo
Atum, com transporte de dados substituível e integração opcional SharePoint/SPMIDDLE.
Não é distribuição oficial nem equivalência integral ao Joomla/PHP. O objetivo é
uma distribuição independente, não uma aplicação corporativa; temas corporativos
são extensões opcionais, nunca requisitos do núcleo.

A versão da fonte em `package.json` é **0.17.6**. Isso não certifica qual release
está ativa em um site remoto. O [estado e limites](docs/ESTADO.md)
distingue implementação, validações históricas e trabalho ainda pendente.

## Características que devem ser preservadas

- Dados → adapter → casos de uso → view models → componentes → template.
  REST não fica embutido na UI. O núcleo executa com adapter fake sem rede.
- Instâncias de módulo são autoritativas; estado, atribuição, agenda, posição,
  ordem e parâmetros têm consumidores no runtime. Plugins ativos têm lifecycle
  e ordem de registro determinística; URL nova exige revisão imutável.
- ETag capturado na abertura protege alterações. Não usar `*`, reescrever campos
  desconhecidos, inventar configuração padrão após corrupção ou repetir escrita
  incerta. Navegação não cancela uma gravação que já entrou no transporte.
- Apenas `default` e `cassiopeia` são builtins (ambos usam Cassiopeia).
  Templates externos são publicados, registrados e selecionados explicitamente.
- Instalação inicial cria oito listas estritamente verificadas e arquivo
  operacional, **zero linhas de conteúdo/configuração**. Sample Data é opcional e
  separado. Journal durável, preflight e recuperação não autorizam adotar listas
  alheias, apagar conteúdo ou repetir uma intenção sem recibo.
- Videoteca/Forum pertencem ao TD e estão suspensos; CAMAP/CAMAP-V3 não são
  defaults ou dependências obrigatórias da instalação genérica.
- Não há ACL própria, PHP/SQL, instalador ZIP de extensões de servidor ou
  equivalência total Joomla. i18n, SEO do host e histórico/check-in de artigo
  não são requisitos implícitos. Permissões reais vêm do backend/host.
- Segredos, dados de instalação e evidências privadas ficam fora da distribuição.
  Operações remotas e publicação têm gates próprios; teste local não os substitui.

## Executar e contribuir

```powershell
npm test
npm run check
npm run test:standalone-examples
node scripts/serve-local.js
```

Servidor somente leitura em `127.0.0.1:8080`: `/examples/index.html` e
`/examples/admin.html`, com dados demonstrativos em storage local da mesma origem.
Não é servidor de produção. `--port` escolhe outra porta; Git, `tmp/` e docs não
são servidos. As verificações de navegador corporativo usam instância própria do
FIORI-AUTO, inclusive para páginas locais.

O runner omite explicitamente integrações opcionais quando o projeto irmão
SPMIDDLE não existe; com ele presente, falha de import/assertion é falha, não skip.
Não mantenha contagens históricas de suítes como garantia da versão atual.
`core` é estágio de fontes, não clone contributor completo com editor/admin;
`all`/`site` dependem dos pacotes SPMIDDLE. Ver [desenvolvimento, demo e empacotamento](docs/DESENVOLVIMENTO.md) e
[critérios de validação](docs/DESENVOLVIMENTO.md#validacao).

## Instalação SharePoint

O instalador recebe um ZIP pronto, sem exigir Node/Git/CLI para instalar.
O mantenedor o prepara com `node scripts/stage-installation-zip.js --version X.Y.Z`.
Copiar/extrair os assets em SiteAssets, criar duas páginas `.aspx` com Modern
Script Editor e usar os snippets incluídos no pacote. O painel inspeciona e
instala o CMS antes de montar a administração. Extensões e Sample Data são ações
posteriores separadas. Siga o [guia de instalação, atualização e recuperação](docs/INSTALACAO.md).

O site usa contêiner dedicado, nunca o corpo inteiro da página SharePoint.
FullBleed é layout de viewport pelo adaptador oficial, não fullscreen nem escape
CSS `100vw`. Releases/assets são imutáveis; atualizar fonte não publica páginas.
Instalação vazia, atualização operacional e reset seguro são fluxos distintos.

## Arquitetura e documentação canônica

- `src/libraries/minijoomla/{core,application,composition,infrastructure,modules,plugins,security}/`:
  configuração/router, casos de uso, composições, adapters, runtime e sanitização.
- `src/components/`, `src/modules/mod_*/`, `src/plugins/`, `src/templates/`:
  componentes públicos e extensões nativas com contratos Joomla-like.
- `src/administrator/components/com_*/` e `src/administrator/templates/atum/`:
  views/controllers administrativos e shell. `com_minijoomla` coordena a aplicação.
- `src/media/`: CSS e vendor TinyMCE; `host-adapters/modern-script-editor/`:
  bootstrap/host/snippets de integração.
- `createMiniJoomlaSiteApplication()` está em
  `src/libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js`.
  Lifecycle `start()/stop()` é idempotente; imports/handlers tardios não assumem
  controle de uma navegação obsoleta.

A documentação própria é organizada por tema, não por ciclo ou release.

| Tema | Conteúdo |
| --- | --- |
| [Contratos](docs/CONTRATOS.md) | Dados, adapters, SPMIDDLE, concorrência e evolução XML |
| [Templates](docs/TEMPLATES.md) | Cassiopeia, instalação, posições, parâmetros e lifecycle |
| [Extensões](docs/EXTENSOES.md) | Administração, módulos/plugins, roots e migração/adoção |
| [Instalação](docs/INSTALACAO.md) | Pacote SharePoint, engine, Sample Data, publicação e rollback |
| [Desenvolvimento](docs/DESENVOLVIMENTO.md) | Setup, demo, contribuição, releases, testes e critérios de aceite |
| [Proveniência](docs/PROVENIENCIA.md) | Derivações, direitos, pacotes e gates de distribuição |
| [Estado](docs/ESTADO.md) | Escopo implementado, lacunas e prioridades de continuidade |

[Segurança](docs/SECURITY.md) e [avisos de terceiros](docs/THIRD-PARTY-NOTICES.md)
mantêm documentos próprios para preservar seu contrato de distribuição.

## Licença e limites de entrega

Código próprio: **GPL-2.0-or-later**, conforme [LICENSE.md](LICENSE.md).
Terceiros mantêm [avisos e pendências de proveniência](docs/THIRD-PARTY-NOTICES.md).
`private: true` bloqueia publicação acidental no npm, não decide visibilidade Git.
Preparação open source, direitos/marcas, privacidade e fonte/build correspondente
não estão aprovados apenas por testes verdes ou ausência de candidatos no auditor.

A UI do executor de migração assistida e aceites assistivos completos ainda são
pendências explícitas. ARIA, CSS computado, reflow por contêiner ou teclado em
fixture não comprovam zoom real 200/400%, forced-colors, leitor de tela, migração
integral ou rollback em todos os domínios. Veja o estado consolidado antes de
anunciar conclusão ou publicar.
