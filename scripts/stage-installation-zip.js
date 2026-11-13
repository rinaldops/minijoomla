#!/usr/bin/env node
/*
 * Gera um unico arquivo .zip pronto para enviar a SiteAssets e extrair,
 * cobrindo o fluxo completo de instalacao inicial sem exigir que o usuario
 * execute scripts, crie pastas manualmente ou identifique qual arquivo vai
 * em qual lugar: node scripts/stage-installation-zip.js --version X.Y.Z
 *   [--output dist/<novo>.zip]
 *
 * Reaproveita stageGenericInstallation() (mesmo pacote testado por
 * tests/generic-installation-package.test.js: nucleo + painel + MSE host +
 * adaptador oficial SPMIDDLE, sem Videoteca/Forum nem config/dados
 * corporativos) e apenas reorganiza a saida dentro da hierarquia definitiva
 * SiteAssets/minijoomla/releases/<versao>/, adicionando um .txt na raiz do
 * zip com os dois snippets prontos (publico/administrativo) ja preenchidos
 * com essa mesma versao -- o unico texto que o usuario realmente precisa
 * copiar e colar no Modern Script Editor.
 */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageGenericInstallation } from './stage-generic-installation.js';
import { buildZip } from './zip-writer.js';
import { writeFileSync, mkdirSync, existsSync, lstatSync } from 'node:fs';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readme(version) {
  return `MINIJOOMLA ${version} -- pacote pronto para instalacao
=======================================================

O QUE FAZER COM ESTE ARQUIVO
-----------------------------
1. Envie este .zip para a biblioteca "SiteAssets" (ou "Documentos do Site")
   do seu site SharePoint, pela interface web (Enviar arquivo / Carregar).
2. Clique com o botao direito no .zip enviado e escolha "Extrair" (ou abra
   o menu "..." > Extrair). O SharePoint cria automaticamente a pasta
   "minijoomla" com toda a estrutura ja organizada -- nao e preciso criar
   pastas manualmente nem copiar arquivo por arquivo.
3. Apague o .zip da biblioteca depois de extrair (opcional, so para limpar).
4. Abra o arquivo "CODIGO-PARA-COLAR-NAS-PAGINAS.txt" (nesta mesma pasta
   raiz do zip) e siga as instrucoes dele para colar o codigo nas duas
   paginas .aspx (site publico e painel administrativo).
5. Depois de publicar as duas paginas com o codigo correto, abra a pagina
   administrativa: o MINIJOOMLA detecta que ainda nao foi instalado e
   mostra a tela de instalacao automaticamente. Preencha o nome do site e
   confirme.

Guia completo com capturas de tela e cada passo detalhado:
docs/MANUAL-INSTALACAO-SHAREPOINT.md (dentro do codigo-fonte do projeto,
https://github.com/rinaldops/minijoomla).

O QUE NAO FAZER
----------------
- Nao abra nem edite nenhum arquivo dentro da pasta "minijoomla/releases/${version}/"
  depois de extrair: essa pasta e uma versao imutavel. Para corrigir algo,
  gere e envie um novo .zip com um numero de versao diferente.
- Nao e necessario ter Node.js, git ou qualquer ferramenta de linha de
  comando instalada na maquina de quem vai extrair o zip no SharePoint --
  tudo o que esse zip contem e HTML/CSS/JavaScript estatico, pronto para
  rodar direto no navegador.
`;
}

function instructionsTxt({ version, webPlaceholder = '/sites/example' }) {
  const base = `${webPlaceholder}/SiteAssets/minijoomla/releases/${version}`;
  const publicSnippet = `<link rel="stylesheet" data-minijoomla-mse-layout href="${base}/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-site" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-site></div>
</div>
<script src="${base}/host/loader.js"></script>`;
  const adminSnippet = `<link rel="stylesheet" data-minijoomla-mse-layout href="${base}/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-admin" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-admin-root></div>
</div>
<script src="${base}/host/loader.js"></script>`;
  return `CODIGO PARA COLAR NAS PAGINAS DO SHAREPOINT -- MINIJOOMLA ${version}
====================================================================

Antes de colar, troque "${webPlaceholder}" pelo caminho real do SEU site
(o trecho que aparece na barra de endereco logo depois do dominio, por
exemplo "/sites/MeuSite" ou "/teams/MinhaEquipe"). Se extraiu o zip em uma
biblioteca diferente de "SiteAssets", ajuste tambem esse trecho do caminho.
Fora essa troca, cole exatamente como esta abaixo -- nao edite mais nada.

Em cada pagina, adicione a webpart "Editor de scripts moderno" (Modern
Script Editor) e cole o codigo correspondente dentro dela.

--------------------------------------------------------------------
1) PAGINA PUBLICA (a pagina que qualquer visitante vai acessar)
--------------------------------------------------------------------
${publicSnippet}

--------------------------------------------------------------------
2) PAGINA ADMINISTRATIVA (recomendado nomear "Administrator.aspx")
--------------------------------------------------------------------
${adminSnippet}

--------------------------------------------------------------------
ATENCAO -- erro mais comum
--------------------------------------------------------------------
Os dois codigos acima sao parecidos, mas NAO SAO IGUAIS: um tem
"data-minijoomla-site" e o outro tem "data-minijoomla-admin-root". E esse
detalhe -- nao o nome do arquivo .aspx -- que decide se a pagina vira o
site publico ou o painel administrativo. Colar o codigo errado na pagina
errada resulta em uma tela em branco ou em erro ao abrir a pagina.

Depois de colar e PUBLICAR as duas paginas, abra a pagina administrativa:
o MINIJOOMLA vai detectar que ainda nao foi instalado neste site e mostrar
a tela de instalacao automaticamente, pedindo o nome do site e uma
confirmacao. Nenhum outro passo manual e necessario.
`;
}

async function stageInstallationZip({ version, output } = {}) {
  if (typeof output !== 'string' || !output.startsWith('dist/') || !output.endsWith('.zip')) throw new Error('--output deve ser um caminho novo em dist/ terminando em .zip');
  const zipPath = resolve(PROJECT, output);
  if (!zipPath.startsWith(resolve(PROJECT, 'dist') + '/') && !zipPath.startsWith(resolve(PROJECT, 'dist') + '\\')) throw new Error('--output deve ficar dentro de dist/');
  if (existsSync(zipPath)) throw new Error('Arquivo de saida ja existe; escolha um novo caminho.');
  await mkdir(resolve(PROJECT, 'tmp'), { recursive: true });
  const stageRoot = await mkdtemp(resolve(PROJECT, 'tmp', 'installation-zip-'));
  try {
    const staged = await stageGenericInstallation({ version, output: relative(PROJECT, join(stageRoot, 'payload')).split('\\').join('/') });
    const entries = [];
    for (const file of staged.manifest.files) {
      const data = await readFile(join(staged.output, file.path));
      // Definitive hierarchy: everything the host/SharePoint needs lives
      // under minijoomla/releases/<version>/, exactly the layout the manual
      // and deploy-sharepoint.mjs already expect -- nothing extra to create.
      entries.push({ name: `minijoomla/releases/${version}/${file.path}`, data });
    }
    entries.push({ name: 'LEIA-ME.txt', data: Buffer.from(readme(version), 'utf8') });
    entries.push({ name: 'CODIGO-PARA-COLAR-NAS-PAGINAS.txt', data: Buffer.from(instructionsTxt({ version }), 'utf8') });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const { zip, sha256 } = buildZip(entries);
    mkdirSync(dirname(zipPath), { recursive: true });
    if (lstatSync(dirname(zipPath), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Destino do zip atraves de link nao permitido.');
    writeFileSync(zipPath, zip, { flag: 'wx' });
    return { output: zipPath, entries: entries.length, bytes: zip.length, sha256, manifest: staged.manifest };
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}

export { stageInstallationZip };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const option = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
  try {
    const version = option('version');
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Uso: node scripts/stage-installation-zip.js --version X.Y.Z [--output dist/<novo>.zip]');
    const output = option('output', `dist/minijoomla-${version}.zip`);
    const result = await stageInstallationZip({ version, output });
    console.log(`Pacote de instalacao pronto: ${result.output} (${result.entries} entradas, ${result.bytes} bytes, sha256 ${result.sha256}).`);
    console.log('Envie esse .zip para SiteAssets e extraia; o .txt na raiz traz os dois codigos do Modern Script Editor.');
  } catch (error) {
    console.error(`stage-installation-zip: ${error.message}`);
    process.exitCode = 1;
  }
}
