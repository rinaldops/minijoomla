/*
 * Minimal, dependency-free ZIP writer (STORE method only -- no compression).
 * Deterministic: fixed DOS date/time, no extra fields, entries sorted by the
 * caller. Verified by round-tripping through Node's own node:zlib unzipSync
 * and the platform's native unzip in tests, so the exact bytes this module
 * produces are the contract, not an assumption about a third-party reader.
 */
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';

const DOS_EPOCH = Date.UTC(1980, 0, 1);

function dosDateTime(date) {
  const value = date.getTime() < DOS_EPOCH ? new Date(DOS_EPOCH) : date;
  const time = ((value.getUTCHours() & 0x1f) << 11) | ((value.getUTCMinutes() & 0x3f) << 5) | ((value.getUTCSeconds() >> 1) & 0x1f);
  const dosDate = (((value.getUTCFullYear() - 1980) & 0x7f) << 9) | (((value.getUTCMonth() + 1) & 0xf) << 5) | (value.getUTCDate() & 0x1f);
  return { time, date: dosDate };
}

function utf8Name(name) {
  if (typeof name !== 'string' || !name || name.startsWith('/') || name.includes('\\') || name.includes('../') || name.includes('..\\')) throw new Error(`Nome de entrada ZIP inválido: ${name}`);
  return Buffer.from(name, 'utf8');
}

/**
 * entries: ordered array of { name, data: Buffer } (name uses forward
 * slashes; directories are implicit from entry names, never written as
 * separate 0-byte entries). Returns a single Buffer with the complete ZIP.
 */
export function buildZip(entries, { when = new Date('2026-01-01T00:00:00Z') } = {}) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('ZIP requer ao menos uma entrada.');
  const { time, date } = dosDateTime(when);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const seen = new Set();
  for (const { name, data } of entries) {
    if (!Buffer.isBuffer(data)) throw new Error(`Dados de entrada ZIP devem ser Buffer: ${name}`);
    const nameBytes = utf8Name(name);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Entrada ZIP duplicada: ${name}`);
    seen.add(key);
    const crc = crc32(data) >>> 0;
    const size = data.length;
    const useUtf8Flag = 1 << 11; // General purpose bit 11: filename is UTF-8.
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // Version needed to extract.
    local.writeUInt16LE(useUtf8Flag, 6);
    local.writeUInt16LE(0, 8); // Method: stored.
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // Version made by.
    central.writeUInt16LE(20, 6); // Version needed to extract.
    central.writeUInt16LE(useUtf8Flag, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); // External attributes.
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralStart = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  const zip = Buffer.concat([...localParts, centralBuffer, end]);
  return { zip, sha256: createHash('sha256').update(zip).digest('hex') };
}
