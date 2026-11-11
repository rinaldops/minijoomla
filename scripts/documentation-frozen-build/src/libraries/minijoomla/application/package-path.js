import { ValidationError } from '../core/contracts.js';

export function packagePath(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || !/^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) throw new ValidationError('Caminho de pacote invalido.');
  return value;
}

export function packageBase(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw new ValidationError('Raiz deve ser server-relative.');
  return `/${packagePath(value.replace(/^\//, '').replace(/\/$/, ''))}/`;
}

export function packageAsset(baseUrl, path) { return `${packageBase(baseUrl)}${packagePath(path)}`; }
