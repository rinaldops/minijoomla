const ACTION_LABELS = { install: 'Registrar', upgrade: 'Atualizar', rollback: 'Reverter versão' };
let confirmationId = 0;

/** Real browser consent; synthetic/older DOMs keep the native confirm fallback. */
export function confirmInstallerAction({ documentRef, entry = {}, message, isCurrent, signal } = {}) {
  const root = documentRef?.body;
  const document = root?.ownerDocument ?? documentRef;
  const current = () => Boolean(root) && !signal?.aborted && (!isCurrent || isCurrent()) && documentRef?.body === root && root.isConnected !== false;
  if (!current()) return Promise.resolve(false);
  const fallback = () => {
    try { return Promise.resolve(globalThis.confirm?.(message)).then((accepted) => accepted === true && current(), () => false); }
    catch { return Promise.resolve(false); }
  };
  if (!document?.createElement || !root?.appendChild) return fallback();
  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') return fallback();

  const label = ACTION_LABELS[entry.action] ?? ACTION_LABELS.install;
  const id = `admin-installer-confirmation-${++confirmationId}`;
  const previousFocus = document.activeElement;
  const heading = document.createElement('h2');
  heading.id = `${id}-title`;
  heading.textContent = entry.action === 'rollback' ? 'Reverter versão da extensão' : `${label} extensão`;
  const description = document.createElement('p');
  description.id = `${id}-description`;
  description.textContent = message;
  const details = document.createElement('p');
  const version = entry.installedVersion ? `${entry.installedVersion} → ${entry.targetVersion ?? entry.version ?? ''}` : entry.targetVersion ?? entry.version;
  details.textContent = [entry.title, version, entry.displaySource ?? entry.discoveredFrom].filter(Boolean).join(' · ');
  const actions = document.createElement('div');
  actions.className = 'admin-form-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'admin-btn admin-btn-ghost';
  cancel.dataset.adminInstallerCancel = 'true';
  cancel.textContent = 'Cancelar';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'admin-btn admin-btn-success';
  accept.dataset.adminInstallerAccept = 'true';
  accept.textContent = label;
  accept.setAttribute('autofocus', '');
  actions.appendChild(cancel);
  actions.appendChild(accept);
  dialog.appendChild(heading);
  dialog.appendChild(description);
  dialog.appendChild(details);
  dialog.appendChild(actions);
  dialog.className = 'admin-installer-confirmation';
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.setAttribute('aria-describedby', description.id);
  dialog.setAttribute('aria-modal', 'true');
  // Scoped presentation: no host stylesheet changes or untrusted HTML/styles.
  dialog.style.maxWidth = 'min(36rem, calc(100vw - 2rem))';
  dialog.style.maxHeight = 'calc(100dvh - 2rem)';
  dialog.style.overflow = 'auto';
  dialog.style.padding = '1.25rem';
  dialog.style.border = '1px solid var(--atum-control-border, #666e76)';
  dialog.style.color = 'var(--atum-gray-700, #495057)';
  dialog.style.font = 'inherit';

  return new Promise((resolve) => {
    let settled = false;
    let observer;
    let timer;
    const view = document.defaultView;
    const setInterval = view?.setInterval?.bind(view) ?? globalThis.setInterval;
    const clearInterval = view?.clearInterval?.bind(view) ?? globalThis.clearInterval;
    const attached = () => current() && dialog.isConnected && root.contains(dialog);
    const finish = (accepted) => {
      if (settled) return;
      const consent = accepted === true && attached() && dialog.open === true;
      const activeFocus = document.activeElement;
      const restoreFocus = attached() && dialog.contains(activeFocus) && previousFocus?.isConnected && root.contains(previousFocus) && !previousFocus.disabled;
      settled = true;
      observer?.disconnect();
      if (timer !== undefined) clearInterval(timer);
      signal?.removeEventListener?.('abort', abort);
      accept.removeEventListener('click', agree);
      cancel.removeEventListener('click', abort);
      dialog.removeEventListener('cancel', cancelDialog);
      dialog.removeEventListener('close', abort);
      dialog.removeEventListener('keydown', keyboard);
      // Native close() can restore remembered focus even from body/viewport.
      // Only invoke it when that restoration is still owned and allowed.
      // Removing an obsolete modal avoids the close focus-restoration steps.
      if (restoreFocus && current()) {
        try { if (dialog.open) dialog.close(); } catch { /* detached dialog cleanup */ }
        dialog.remove();
      } else {
        dialog.remove();
        dialog.removeAttribute('open');
      }
      if (restoreFocus && current() && previousFocus.isConnected && root.contains(previousFocus) && !previousFocus.disabled && document.activeElement !== previousFocus) {
        try { previousFocus.focus?.({ preventScroll: true }); } catch { /* focus must not block settlement */ }
      }
      resolve(consent);
    };
    const agree = () => finish(true);
    const abort = () => finish(false);
    const cancelDialog = (event) => { event.preventDefault(); abort(); };
    const keyboard = (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (event.isComposing || event.repeat) return;
      finish(event.target !== cancel);
    };
    const check = () => { if (!attached() || !dialog.open) abort(); };
    accept.addEventListener('click', agree);
    cancel.addEventListener('click', abort);
    dialog.addEventListener('cancel', cancelDialog);
    dialog.addEventListener('close', abort);
    dialog.addEventListener('keydown', keyboard);
    signal?.addEventListener?.('abort', abort, { once: true });
    try {
      root.appendChild(dialog);
      dialog.showModal();
      if (settled) return;
      if (!attached() || !dialog.open) { abort(); return; }
      accept.focus();
      const MutationObserver = view?.MutationObserver ?? globalThis.MutationObserver;
      if (MutationObserver) {
        observer = new MutationObserver(check);
        observer.observe(document.documentElement ?? root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
      }
      // The application has no page-disposal hook: stop() changes only isCurrent.
      // This timer exists only for the open dialog and is cleared on EVERY exit.
      if (isCurrent) timer = setInterval(check, 100);
    } catch { abort(); } // A supported dialog failing to open never bypasses consent.
  });
}
