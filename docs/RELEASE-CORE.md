# Staging independente do núcleo

O target opcional `core` prepara **fontes locais**, sem abrir ou exigir
`../SPMIDDLE/packages`. Não é publicação, pacote npm, CMS pronto para implantação
ou release de tenant. Não muda o target padrão `all` nem o target `site`.

```bash
npm run release:stage -- --version 0.2.0 --output tmp/core-0.2.0 --target core
```

`0.2.0` acima é uma versão de exemplo local, não uma reserva/publicação. Use uma
subpasta nova de `tmp/`; qualquer destino existente é recusado. O script resolve
saídas relativas à pasta MINIJOOMLA, independentemente do diretório do terminal.

## O que entra

- O fechamento inclui também `joomla-discovery.js` e `joomla-extension-installer.js`.
- O único vendor autorizado no core é `libraries/vendor/parse-xml/parse-xml.js`,
  alcançado pelo grafo; `LICENSE` e `notices.txt` ISC são copiados explicitamente
  e declarados em `entrypoints.json.licenses` quando o parser está incluído.
- SPMIDDLE e TinyMCE não entram no core.

- Fechamento transitivo de `src/index.js`, `src/administrator/components/com_minijoomla/app.js` e
  `src/media/templates/administrator/atum/css/template.css`, incluindo imports relativos ES, CSS e assets locais.
- CSS dos templates nativos declarados em `template-runtime.js`.
- `loader.js`, `entrypoints.json` e manifesto SHA-256 determinístico.
- `LICENSE.md`, texto GPL-2.0 e aviso específico dos componentes deste recorte.

O loader expõe `modules.public.createApplication` e
`modules.admin.createAdminApplication`. O arquivo `entrypoints.json` identifica
o CSS administrativo em `styles.admin`; resolva esse caminho contra
`releaseBase`. O loader apenas importa módulos e chama `start` injetado: não
monta telas ou injeta configuração automaticamente.

Forneça um `documentRef` cujo `body` seja exclusivamente o contêiner dedicado à
aplicação; painel e site usam páginas/contêineres separados. A UI administrativa
exige `adminService` e pode receber `discoveryService`. O adapter fake padrão do
site é somente leitura e usa dados demonstrativos locais.

## Exclusões e falhas explícitas

Não há composições, adapters/cliente de arquivos SPMIDDLE/SharePoint, snippet de
host, configuração de tenant, bootstrap antigo, backend, ACL ou persistência
administrativa prontos. Arquivos não alcançados pelos entrypoints não são
copiados. Uma dependência obrigatória de host/vendor ou fora de `src/` **falha**
em vez de ser omitida silenciosamente. Imports ou assets locais ausentes também
falham antes da escrita; links/junctions e escapes de caminho são recusados.

A ponte própria `admin/editor.js` entra porque o painel importa seu marcador de
readmore, mas **TinyMCE não entra**: não é um import/asset obrigatório da UI.
Sem `richTextEditorFactory`, o painel mantém os campos como `textarea`. Um editor
rico precisa ser injetado e seus assets/licenças validados separadamente.
Portanto não se copia a licença MIT de SPMIDDLE nem se anuncia conformidade da
distribuição TinyMCE ausente. As pendências de fonte correspondente do TinyMCE e
licença SPMIDDLE continuam relevantes para `all`/`site` quando incluírem esses
componentes; este target não corrige nem relaxa seus gates históricos.

## Verificação local

```bash
node --input-type=module -e "const t = await import('./tests/release-stage.test.js'); await t.runReleaseCoreStageTests();"
npm run test:release-stage
```

A primeira verificação não exige SPMIDDLE: usa fixtures sintéticas e cópia das
fontes reais dentro de `tmp/`, com caminho de packages ausente, testa o loader
em Node sem rede, hashes, licenças, caminhos e falhas do grafo. A segunda
preserva também os testes de `all`/`site` e, por isso, exige o projeto irmão.
Overrides de fontes são API para fixtures existentes sob `tmp/`, não uma opção
CLI nem autorização de acesso arbitrário ao sistema de arquivos.

Staging não é auditoria de dados, direitos, acessibilidade ou segurança de uma
implantação. O recorte conserva os templates atuais, inclusive sua aparência;
não comprova neutralização visual ou aceite Joomla. Nenhum navegador, tenant,
rede, commit ou push faz parte desta operação.
