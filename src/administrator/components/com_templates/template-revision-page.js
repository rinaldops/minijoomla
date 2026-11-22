/*
 * UI administrativa de REVISÃO de um template já registrado (rota própria
 * #/templates/revision, separada de #/templates e #/templates/discover).
 * Consome exclusivamente `createTemplateRevisionService` (prepare/commit/
 * rollback) — ver docs/TEMPLATES.md §7 e docs/CONTRATOS.md. Esta tela NUNCA
 * chama `adminService.templates.update/create/remove` nem
 * `adminService.siteConfig.save` diretamente: o guard CRUD normal do painel
 * (app.js: bindFormHandlers) permanece a única porta de escrita direta do
 * registro de template; a revisão seletiva passa só pelo serviço injetado.
 * Não publica arquivos, não ativa template, não registra manifesto novo —
 * isso continua em com_templates/src/Controller/discover.js (registro
 * inicial) e fora do Main (publicação/ativação/aceite LIVE).
 *
 * Fluxo de 3 estágios na mesma renderização (sem round-trip de navegação):
 * 1) `[data-revision-prepare]`: somente leitura (`prepare`), monta
 *    `candidate` a partir do formulário e mostra um resumo/diff — nenhuma
 *    escrita acontece aqui.
 * 2) `[data-revision-commit]`: exige confirmação explícita (`confirmCommit`
 *    marcado) e dispara UMA chamada a `commit`.
 * 3) `[data-revision-rollback]`: só aparece após um commit bem-sucedido,
 *    usa o `rollback`/`expectedETag` do próprio receipt devolvido pelo
 *    commit (nunca um ETag montado à mão) e segue o mesmo padrão de
 *    confirmação explícita.
 *
 * Lock de UMA intenção por visita (não apenas por estágio):
 * - `prepare` só pode ser tentado UMA vez por visita — sucesso ou falha.
 *   Uma vez que a tentativa termina, o formulário de prepare nunca é
 *   reabilitado nesta visita; não existe "tentar de novo" sem recarregar a
 *   página (nova visita, novo estado).
 * - Enquanto qualquer estágio (`prepare`/`commit`/`rollback`) está em voo,
 *   nenhum outro handler desta página aceita submit (`globalBusy`); isso
 *   evita que um novo `prepare` sobrescreva um `ready`/`receipt` em uso por
 *   um `commit`/`rollback` ainda em andamento.
 * - `commit`/`rollback` continuam de consumo único (`commitConsumed`/
 *   `rollbackConsumed`): o botão nunca é reativado para o mesmo
 *   plano/receipt, mesmo em falha.
 * - Um resultado `uncertain` (em `commit` OU `rollback`) trava TODA nova
 *   escrita e preparação nesta visita (`uncertainLocked`): a mensagem
 *   exibida NUNCA orienta recarregar a página nem repetir o prepare como
 *   forma de "tentar de novo" — exige conferência/reconciliação externa do
 *   registro, e não anuncia nenhuma recuperação automática.
 *
 * Estado (plan/receipt) vive só no closure de `bindTemplateRevisionPage`
 * para esta visita da tela — igual ao resto do painel, que substitui
 * `documentRef.body.innerHTML` por completo a cada navegação (app.js). Uma
 * navegação para longe perde o estado; o serviço mantém sua própria
 * retenção de sessão (ver TEMPLATES.md), mas esta UI não presume reabrir o
 * mesmo plano depois de recarregar.
 */
import { escapeHtml } from '../../../libraries/minijoomla/security/sanitize.js';

const DIFF_FIELDS = [
  ['template', 'Template'],
  ['versions', 'Versão atual → candidata'],
  ['entrypoint', 'Novo entrypoint'],
  ['styles', 'Estilos declarados no manifesto'],
  ['positions', 'Posições/parâmetros'],
  ['candidateAssets', 'Assets candidatos verificados'],
  ['legacyAssets', 'Assets atuais preservados para rollback']
];

export function renderTemplateRevisionPage(templates, link, shell) {
  const rows = Array.isArray(templates) ? templates : [];
  const options = rows.map((row) => `<option value="${escapeHtml(String(row.id))}">${escapeHtml(`${row.title} (${row.key} · v${row.version})`)}</option>`).join('');
  const diffRows = DIFF_FIELDS.map(([name, label]) => `<dt>${escapeHtml(label)}</dt><dd data-revision-field="${name}"></dd>`).join('');
  const body = `<p>Revisão seletiva de um template já registrado: atualiza apenas <code>version</code>, <code>entryPointUrl</code> e <code>styles</code> do registro, a partir de um pacote imutável já publicado no mesmo site. Não publica arquivos, não ativa o template, não altera a configuração do site e não registra um manifesto novo.</p>`
    + (!rows.length ? '<p class="admin-empty" role="status">Nenhum template registrado para revisar.</p>' : `<form data-revision-prepare class="admin-form">
      <div class="admin-field"><label for="admin-revision-template">Template</label><select id="admin-revision-template" name="templateId" required><option value="">Selecione…</option>${options}</select></div>
      <div class="admin-field"><label for="admin-revision-base">Base da revisão (baseUrl)</label><input id="admin-revision-base" name="baseUrl" required placeholder="/sites/exemplo/SiteAssets/templates/sample/1.0.1/"></div>
      <div class="admin-field"><label for="admin-revision-manifest">Caminho do manifesto (manifestPath)</label><input id="admin-revision-manifest" name="manifestPath" required value="manifest.json"></div>
      <div class="admin-field"><label for="admin-revision-inventory">Caminho do inventário (inventoryPath)</label><input id="admin-revision-inventory" name="inventoryPath" required value="inventory.json"></div>
      <div class="admin-field"><label for="admin-revision-hash">Hash do inventário (sha256)</label><input id="admin-revision-hash" name="inventoryHash" required pattern="[0-9a-fA-F]{64}" maxlength="64"></div>
      <button type="submit" class="admin-btn admin-btn-primary">Analisar revisão</button>
    </form>`)
    + `<p role="status" aria-live="polite" aria-atomic="true" data-revision-status></p>
    <dl class="admin-meta" data-revision-diff hidden>${diffRows}</dl>
    <form data-revision-commit class="admin-form" hidden>
      <label><input type="checkbox" name="confirmCommit" required> Confirmo que revisei o diff acima e autorizo a escrita seletiva (version/entryPointUrl/styles) deste template.</label>
      <button type="submit" class="admin-btn admin-btn-success">Aplicar revisão</button>
    </form>
    <form data-revision-rollback class="admin-form" hidden>
      <p data-revision-field="committed"></p>
      <label><input type="checkbox" name="confirmRollback" required> Confirmo que desejo desfazer esta revisão e restaurar a referência anterior.</label>
      <button type="submit" class="admin-btn admin-btn-danger">Desfazer revisão</button>
    </form>
    <p class="admin-help">O pacote candidato precisa já estar publicado no site antes da análise; esta tela não copia arquivos.</p>`;
  return shell({ activeKey: 'templateRevision', pageTitle: 'Revisão de template', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Templates', href: link('/templates') }, { label: 'Revisão' }], bodyHtml: body, link });
}

function setField(diffEl, name, text) {
  const el = diffEl?.querySelector?.(`[data-revision-field="${name}"]`);
  if (el) el.textContent = text;
}

/*
 * `isCurrent`: mesmo contrato usado pelo resto do painel (app.js) e pelo
 * próprio serviço — interrompe antes de qualquer atualização de DOM ou
 * nova chamada quando a navegação já avançou (stale navigation nunca
 * autoriza escrita nem atualização visual tardia).
 */
export function bindTemplateRevisionPage({ documentRef, templateRevisionService, isCurrent = () => true }) {
  const root = documentRef?.body;
  if (!root) return;
  const prepareForm = root.querySelector?.('[data-revision-prepare]');
  const statusEl = root.querySelector?.('[data-revision-status]');
  const diffEl = root.querySelector?.('[data-revision-diff]');
  const commitForm = root.querySelector?.('[data-revision-commit]');
  const rollbackForm = root.querySelector?.('[data-revision-rollback]');
  const report = (message) => { if (isCurrent() && statusEl) statusEl.textContent = message; };

  let ready = null;
  let receipt = null;
  // Lock de uma intenção por visita: enquanto `globalBusy` é true, nenhum
  // outro handler desta página aceita submit — impede que um novo prepare
  // sobrescreva um ready/receipt que um commit/rollback ainda em voo está
  // usando. `prepareAttempted` nunca é revertido: o formulário de prepare é
  // tentável exatamente uma vez por visita, sucesso ou falha; não existe
  // "tentar de novo" sem recarregar a página (nova visita, novo estado).
  // `uncertainLocked` trava toda nova escrita/preparação nesta visita assim
  // que qualquer `uncertain` ocorre; a UI nunca sugere recarregar/repetir
  // como forma de contornar isso.
  let globalBusy = false;
  let prepareAttempted = false;
  let uncertainLocked = false;
  let commitConsumed = false;
  let rollbackConsumed = false;

  function lockPrepareForm() {
    if (!prepareForm) return;
    const button = prepareForm.querySelector?.('button[type="submit"]');
    if (button) button.disabled = true;
  }

  function resetAfterStage(hideDiff, hideCommit, hideRollback) {
    if (diffEl) diffEl.hidden = hideDiff;
    if (commitForm) commitForm.hidden = hideCommit;
    if (rollbackForm) rollbackForm.hidden = hideRollback;
  }

  prepareForm?.addEventListener?.('submit', async (event) => {
    event?.preventDefault?.();
    if (globalBusy || prepareAttempted || uncertainLocked || !isCurrent()) return;
    globalBusy = true;
    prepareAttempted = true; // Single attempt per visit, regardless of outcome below.
    lockPrepareForm();
    try {
      const templateId = Number(prepareForm.querySelector?.('[name="templateId"]')?.value);
      const candidate = {
        baseUrl: prepareForm.querySelector?.('[name="baseUrl"]')?.value ?? '',
        manifestPath: prepareForm.querySelector?.('[name="manifestPath"]')?.value ?? '',
        inventoryPath: prepareForm.querySelector?.('[name="inventoryPath"]')?.value ?? '',
        inventoryHash: prepareForm.querySelector?.('[name="inventoryHash"]')?.value ?? ''
      };
      const result = await templateRevisionService.prepare({ templateId, candidate, isCurrent });
      if (!isCurrent()) return;
      if (result?.status !== 'ready') {
        report(result?.message ?? 'Não foi possível preparar a revisão.');
        resetAfterStage(true, true, true);
        return;
      }
      ready = result;
      receipt = null;
      commitConsumed = false;
      rollbackConsumed = false;
      setField(diffEl, 'template', `${ready.plan.snapshot.template.title ?? ''} (${ready.plan.snapshot.template.key ?? ''})`);
      setField(diffEl, 'versions', `${ready.plan.snapshot.template.version} → ${ready.plan.manifest.version}`);
      setField(diffEl, 'entrypoint', ready.plan.after.entryPointUrl);
      setField(diffEl, 'styles', String(Array.isArray(ready.plan.manifest.styles) ? ready.plan.manifest.styles.length : 0));
      setField(diffEl, 'positions', 'Inalterados (verificado pelo serviço antes de preparar).');
      setField(diffEl, 'candidateAssets', String(ready.plan.candidateAssets.length));
      setField(diffEl, 'legacyAssets', String(ready.snapshot.assets.length));
      resetAfterStage(false, true, true);
      if (commitForm) {
        commitForm.hidden = false;
        const checkbox = commitForm.querySelector?.('[name="confirmCommit"]');
        if (checkbox) checkbox.checked = false;
        const button = commitForm.querySelector?.('button[type="submit"]');
        if (button) button.disabled = false;
      }
      report('Revisão pronta para confirmação. Revise o diff antes de aplicar.');
    } catch {
      if (isCurrent()) report('Não foi possível preparar a revisão.');
    } finally {
      globalBusy = false;
      // prepareAttempted is permanent for this visit; only touch the DOM
      // (re-disable the button) when this is still the active navigation —
      // a stale visit's prepareForm may already be detached/replaced.
      if (isCurrent()) lockPrepareForm();
    }
  });

  commitForm?.addEventListener?.('submit', async (event) => {
    event?.preventDefault?.();
    if (globalBusy || commitConsumed || uncertainLocked || !ready || !isCurrent()) return;
    const checkbox = commitForm.querySelector?.('[name="confirmCommit"]');
    if (checkbox?.checked !== true) return;
    globalBusy = true;
    commitConsumed = true; // Single intent: never retried automatically, even on failure/uncertain.
    const button = commitForm.querySelector?.('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const result = await templateRevisionService.commit({ plan: ready.plan, expectedETag: ready.expectedETag, confirm: true, isCurrent });
      if (!isCurrent()) return;
      if (result?.status !== 'committed') {
        if (result?.reason === 'uncertain') {
          uncertainLocked = true;
          report(`${result?.message ?? 'Operação indeterminada.'} Esta revisão não pode continuar nesta tela: confira o registro diretamente antes de qualquer nova ação. Não é um retry automático.`);
        } else {
          report(result?.message ?? 'Não foi possível aplicar a revisão.');
        }
        return;
      }
      receipt = result;
      rollbackConsumed = false;
      if (commitForm) commitForm.hidden = true;
      if (rollbackForm) {
        const summary = rollbackForm.querySelector?.('[data-revision-field="committed"]');
        if (summary) summary.textContent = `Revisão aplicada. Novo ETag: ${result.postUpdateETag}.`;
        rollbackForm.hidden = false;
        const rollbackCheckbox = rollbackForm.querySelector?.('[name="confirmRollback"]');
        if (rollbackCheckbox) rollbackCheckbox.checked = false;
        const rollbackButton = rollbackForm.querySelector?.('button[type="submit"]');
        if (rollbackButton) rollbackButton.disabled = false;
      }
      report('Revisão aplicada com sucesso.');
    } catch {
      if (isCurrent()) report('Não foi possível aplicar a revisão.');
    } finally {
      globalBusy = false;
    }
  });

  rollbackForm?.addEventListener?.('submit', async (event) => {
    event?.preventDefault?.();
    if (globalBusy || rollbackConsumed || uncertainLocked || !receipt || !isCurrent()) return;
    const checkbox = rollbackForm.querySelector?.('[name="confirmRollback"]');
    if (checkbox?.checked !== true) return;
    globalBusy = true;
    rollbackConsumed = true; // Single intent, same no-retry rule as commit.
    const button = rollbackForm.querySelector?.('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const result = await templateRevisionService.rollback({ rollback: receipt.rollback, expectedETag: receipt.rollback.expectedETag, confirm: true, isCurrent });
      if (!isCurrent()) return;
      if (result?.status !== 'rolled-back') {
        if (result?.reason === 'uncertain') {
          uncertainLocked = true;
          report(`${result?.message ?? 'Operação indeterminada.'} Esta revisão não pode continuar nesta tela: confira o registro diretamente antes de qualquer nova ação. Não é um retry automático.`);
        } else {
          report(result?.message ?? 'Não foi possível desfazer a revisão.');
        }
        return;
      }
      report('Revisão desfeita com sucesso.');
      if (rollbackForm) rollbackForm.hidden = true;
    } catch {
      if (isCurrent()) report('Não foi possível desfazer a revisão.');
    } finally {
      globalBusy = false;
    }
  });
}

export async function loadTemplateRevisionPage({ templateRevisionService, adminService, documentRef, router, shell, isCurrent = () => true } = {}) {
  const link = (path, params) => router.link(path, params);
  const fallback = (bodyHtml, pageTitle = 'Revisão de template') => ({ html: shell({ activeKey: 'templateRevision', pageTitle, breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Templates', href: link('/templates') }, { label: 'Revisão' }], bodyHtml, link }) });
  if (!templateRevisionService) return fallback('<p class="admin-empty" role="status">Revisão de template não está configurada nesta composição.</p>');
  if (adminService?.templates?.available === false) return fallback('<p role="status">Catálogo de templates não configurado. A revisão depende do catálogo de templates registrados.</p>');
  let templates = [];
  try { templates = await adminService.templates.list(); } catch { return fallback('<p role="alert">Não foi possível carregar os templates registrados. Nenhum dado foi alterado.</p>'); }
  return {
    html: renderTemplateRevisionPage(templates, link, shell),
    bind() { bindTemplateRevisionPage({ documentRef, templateRevisionService, isCurrent }); }
  };
}
