/*
 * Pré-visualização de posições do template (equivalente administrativo do
 * `tp=1` do Joomla): cada posição declarada pelo template com os módulos
 * atribuídos a ela, mais os módulos em posições que o template não exibe.
 * View pura: recebe o catálogo de posições e os módulos já carregados.
 */
import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';
import { moduleState } from '../../../../../libraries/minijoomla/application/module-assignment.js';

const esc = (value) => escapeHtml(String(value ?? ''));
const STATE_LABELS = { published: 'Publicado', unpublished: 'Despublicado', trashed: 'Na lixeira' };

export function renderPositionsPreview(positions, modules, { link } = {}) {
  const rows = Array.isArray(modules) ? modules : [];
  const boxes = positions.positions.map((position) => {
    const assigned = rows.filter((row) => row.position === position).sort((a, b) => (Number(a.ordering) || 0) - (Number(b.ordering) || 0));
    const list = assigned.length ? `<ul>${assigned.map((row) => `<li><a href="${esc(link(`/moduleInstances/${row.id}`))}">${esc(row.title)}</a> <span class="admin-badge${moduleState(row) === 'published' ? '' : ' is-muted'}">${esc(STATE_LABELS[moduleState(row)])}</span></li>`).join('')}</ul>` : '<p>Vazia</p>';
    return `<section class="admin-position-box" aria-label="Posição ${esc(position)}"><h2>${esc(position)}</h2>${list}</section>`;
  }).join('');
  const orphan = rows.filter((row) => !positions.positions.includes(row.position));
  const orphanHtml = orphan.length ? `<h2 class="admin-section-title">Módulos em posições que este template não exibe</h2><ul>${orphan.map((row) => `<li><a href="${esc(link(`/moduleInstances/${row.id}`))}">${esc(row.title)}</a> — <code>${esc(row.position)}</code></li>`).join('')}</ul>` : '';
  return `<div class="admin-position-grid">${boxes}</div>${orphanHtml}`;
}
