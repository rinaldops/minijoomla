import { ValidationError, ownDataValue } from '../core/contracts.js';
import { templateStyles } from './extension-input.js';
import { normalizeParamDefinitions, parseJsonObject } from './declared-params.js';

const FORMAT = 'minijoomla-template-metadata-v1';
const MAX_BYTES = 64 * 1024;
function parseStyles(input) {
  if (input === undefined || input === null || input === '') return [];
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > MAX_BYTES) throw new ValidationError('Metadata de template excede 64 KiB.');
    const text=input.trim();
    if (!text.startsWith('[') && !text.startsWith('{')) return input;
    try { return JSON.parse(input); } catch { throw new ValidationError('Metadata de template inválida.'); }
  }
  return input;
}
function cssList(input) {
  if(Array.isArray(input)) {
    if(Object.getPrototypeOf(input)!==Array.prototype || input.length>50)throw new ValidationError('Lista CSS de template inválida.');
    const descriptors=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(descriptors);
    if(keys.length!==input.length+1 || keys.some(key=>typeof key!=='string' || key!=='length'&&!/^(0|[1-9]\d*)$/.test(key)))throw new ValidationError('Lista CSS deve conter somente dados densos.');
    const copied=[];
    for(let i=0;i<input.length;i++){const d=descriptors[i];if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string')throw new ValidationError('Lista CSS deve conter somente URLs.');copied.push(d.value);}
    input=copied;
  }
  const encoded=templateStyles(input);
  const values=encoded ? JSON.parse(encoded) : [];
  if (values.length>50) throw new ValidationError('Metadata de template aceita até 50 estilos CSS.');
  if(new TextEncoder().encode(JSON.stringify(values)).length>MAX_BYTES)throw new ValidationError('Metadata de template excede 64 KiB.');
  return values;
}
export function readTemplateMetadata(record = {}) {
  const parsed=parseStyles(ownDataValue(record,'styles'));
  if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) return {styles:cssList(parsed),definitions:[],metadataPresent:false};
  const value=parseJsonObject(parsed,{strict:true,field:'Metadata de template'});
  if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_BYTES)throw new ValidationError('Metadata de template excede 64 KiB.');
  if (!Object.hasOwn(value,'format') || value.format!==FORMAT || !Object.hasOwn(value,'styles') || !Object.hasOwn(value,'paramDefinitions')) throw new ValidationError('Formato de metadata de template não suportado.');
  if (!Array.isArray(value.styles) || !Array.isArray(value.paramDefinitions)) throw new ValidationError('Metadata de template requer listas CSS e definições.');
  return {styles:cssList(value.styles),definitions:normalizeParamDefinitions(value.paramDefinitions),metadataPresent:true};
}
/** One existing Styles column holds CSS and declared parameters; no schema migration. */
export function packTemplateMetadata(styles, definitions, existing) {
  const previous=parseStyles(existing);
  let retained={};
  if (previous && typeof previous==='object' && !Array.isArray(previous)) {
    readTemplateMetadata({styles:previous});
    retained=parseJsonObject(previous,{strict:true,field:'Metadata de template'});
  }
  const css=styles===undefined ? readTemplateMetadata({styles:existing}).styles : readTemplateMetadata({styles}).styles;
  const value={...retained,format:FORMAT,styles:css,paramDefinitions:normalizeParamDefinitions(definitions===undefined&&Object.hasOwn(retained,'paramDefinitions')?retained.paramDefinitions:definitions)};
  const encoded=JSON.stringify(value);
  if(new TextEncoder().encode(encoded).length>MAX_BYTES)throw new ValidationError('Metadata de template excede 64 KiB.');
  return encoded;
}
