import { ValidationError } from '../core/contracts.js';

/** Match assets to VERIFIED descriptors, not untrusted UI metadata or latest CSS. */
export function assertJoomlaPackageAssets(config, descriptors) {
  if (!Array.isArray(descriptors) || !descriptors.length) throw new ValidationError('Descritores verificados ausentes.');
  for (const descriptor of descriptors) {
    const revisions = config?.moduleStyleRevisions?.[descriptor.key];
    if (!revisions || !Object.hasOwn(revisions, descriptor.entryPointUrl)) throw new ValidationError('Revisão JavaScript sem vínculo CSS explícito.');
    // Preserve XML order: base.css/override.css is not an unordered set.
    const expected = [...descriptor.styles];
    const actual = revisions[descriptor.entryPointUrl];
    if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) throw new ValidationError('CSS da revisão difere do pacote verificado.');
    if (new Set(actual).size !== actual.length) throw new ValidationError('CSS duplicado no vínculo de revisão.');
  }
  return true;
}
