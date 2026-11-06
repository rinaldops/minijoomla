import { ARTICLE_OPTION_FIELDS, ARTICLE_IMAGE_FIELDS, ARTICLE_LINK_FIELDS } from '../../../com_minijoomla/field-schemas.js';
import { READMORE_MARKER } from '../../../com_minijoomla/editor.js';
import { parseJsonObject } from '../../../../../libraries/minijoomla/application/declared-params.js';
import { ValidationError } from '../../../../../libraries/minijoomla/core/contracts.js';

export const ARTICLE_URL_PATTERN = /^(\/(?!\/)|https?:\/\/)[^\s\\]*$/i;

const DATE_FIELDS = ['publishUp', 'publishDown', 'featuredUp', 'featuredDown'];

export function toArticleFormValues(record = {}) {
  const introtext = record.introtext ?? '';
  const fulltext = record.fulltext ?? '';
  const values = { ...record, articletext: fulltext ? `${introtext}${READMORE_MARKER}${fulltext}` : introtext };
  for (const name of DATE_FIELDS) {
    if (!record[name]) continue;
    const date = new Date(record[name]);
    if (!Number.isFinite(date.getTime())) continue;
    const pad = (value) => String(value).padStart(2, '0');
    values[name] = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return values;
}

export function fromArticleFormValues(values = {}) {
  const { articletext, ...rest } = values;
  if (articletext === undefined) return rest;
  const parts = String(articletext).split(READMORE_MARKER);
  return { ...rest, introtext: parts[0] ?? '', fulltext: parts.length > 1 ? parts.slice(1).join(READMORE_MARKER) : '' };
}

export function prepareArticleFormValues(rawValues, { record = {}, isNew = false, optionValues = {}, groupValues = {} } = {}) {
  const raw = { ...rawValues };
  const values = fromArticleFormValues(raw);
  const initial = toArticleFormValues(record);
  for (const name of DATE_FIELDS) {
    if (raw[name] === undefined) continue;
    if (!isNew && raw[name] === (initial[name] ?? '')) delete values[name];
    else if (raw[name]) {
      const date = new Date(raw[name]);
      if (!Number.isFinite(date.getTime())) throw new ValidationError(`${name}: data inválida.`);
      values[name] = date.toISOString();
    }
  }

  const activeOptions = Object.keys(optionValues).some((name) => optionValues[name] !== undefined);
  const activeGroups = Object.keys(groupValues).some((name) => groupValues[name] !== undefined);
  if (activeOptions || activeGroups) {
    let attribs;
    try { attribs = parseJsonObject(record.attribsJson, { strict: true, field: 'Opções' }); }
    catch { throw new ValidationError('Opções: JSON inválido; controles não podem ser aplicados.'); }
    const original = JSON.stringify(attribs);
    for (const field of [...ARTICLE_IMAGE_FIELDS, ...ARTICLE_LINK_FIELDS]) {
      const value = groupValues[field.name];
      if (value === undefined) continue;
      const current = attribs[field.group] && typeof attribs[field.group] === 'object' && !Array.isArray(attribs[field.group]) ? attribs[field.group] : {};
      const nextValue = String(value).trim();
      if (nextValue === String(current[field.key] ?? '')) continue;
      if (/^(images:image_(intro|fulltext)|urls:url[abc])$/.test(field.name) && nextValue && !ARTICLE_URL_PATTERN.test(nextValue)) throw new ValidationError(`${field.label}: use um caminho iniciado por / ou uma URL http(s).`);
      const next = { ...current };
      if (nextValue) next[field.key] = nextValue; else delete next[field.key];
      if (Object.keys(next).length) attribs[field.group] = next; else delete attribs[field.group];
    }
    for (const field of ARTICLE_OPTION_FIELDS) {
      const value = optionValues[field.name];
      if (value === undefined) continue;
      const previous = [true, 1, '1'].includes(attribs[field.key]) ? '1' : [false, 0, '0'].includes(attribs[field.key]) ? '0' : '';
      if (value === previous) continue;
      if (value === '') {
        if (['', '0', '1', 0, 1, true, false].includes(attribs[field.key])) delete attribs[field.key];
      } else attribs[field.key] = value;
    }
    if (JSON.stringify(attribs) !== original) values.attribsJson = JSON.stringify(attribs);
  }
  return values;
}
