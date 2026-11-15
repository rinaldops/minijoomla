import { ValidationError } from '../core/contracts.js';
import { parseJsonObject } from './declared-params.js';

// Presentation preferences share the existing JSON column; no schema migration.
export function readHomeShowComponent(componentParamsJson) {
  const params = parseJsonObject(componentParamsJson, { strict: true, field: 'componentParamsJson' });
  if (!Object.hasOwn(params, 'home')) return true;
  const home = params.home;
  if (!home || typeof home !== 'object' || Array.isArray(home)) throw new ValidationError('home deve ser um objeto JSON. Nenhum dado foi alterado.');
  if (!Object.hasOwn(home, 'showComponent')) return true;
  if (typeof home.showComponent !== 'boolean') throw new ValidationError('home.showComponent deve ser booleano. Nenhum dado foi alterado.');
  return home.showComponent;
}

export function mergeHomeShowComponent(componentParamsJson, showComponent) {
  if (typeof showComponent !== 'boolean') throw new ValidationError('homeShowComponent deve ser booleano.');
  const current = readHomeShowComponent(componentParamsJson);
  const params = parseJsonObject(componentParamsJson, { strict: true, field: 'componentParamsJson' });
  // Absent home preserves inline config at composition. Persist an explicit Sim
  // on save so it can override an inline Não; explicit no-ops remain byte-exact.
  if (Object.hasOwn(params, 'home') && current === showComponent) return componentParamsJson;
  return JSON.stringify({ ...params, home: { ...params.home, showComponent } });
}
