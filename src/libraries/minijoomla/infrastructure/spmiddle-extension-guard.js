import { ValidationError } from '../core/contracts.js';

/** Inspect the actual field constraint; schema declarations alone are not proof. */
export function createAtomicExtensionKeyGuard({ transport, webUrl, listId } = {}) {
  return async () => {
    if (!/^\/[a-zA-Z0-9_/-]+$/.test(webUrl ?? '') || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(listId ?? '')) throw new ValidationError('Destino do catalogo de extensoes invalido.');
    const response = await transport.request(`${webUrl === '/' ? '' : webUrl}/_api/web/lists(guid'${listId}')/fields/getbyinternalnameortitle('Key')?$select=InternalName,TypeAsString,Indexed,EnforceUniqueValues`, { method: 'GET' });
    const field = response?.data?.d ?? response?.data;
    return field?.InternalName === 'Key' && field.TypeAsString === 'Text' && field.Indexed === true && field.EnforceUniqueValues === true;
  };
}
