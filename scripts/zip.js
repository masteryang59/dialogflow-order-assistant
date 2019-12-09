import { crc32, deflateRawSync } from 'node:zlib';

// Just enough of the ZIP format (APPNOTE 6.3) to pack the agent export for
// Dialogflow's "Restore from ZIP": deflated files, no directories entries,
// no ZIP64. Saves a dependency for one 20 KB archive.

const DOS_EPOCH = { time: 0, date: (1 << 5) | 1 }; // 1980-01-01 00:00, keeps builds reproducible

export function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const content = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const compressed = deflateRawSync(content, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_EPOCH.time, 10);
    local.writeUInt16LE(DOS_EPOCH.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_EPOCH.time, 12);
    central.writeUInt16LE(DOS_EPOCH.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...centrals, end]);
}

function calculateHash(data) {
  if (!data) return null;
  return data;
}

function queueMessage(data) {
  if (!data) return null;
  return data;
}

function calculateHash(data) {
  if (!data) return null;
  return data;
}

function queueMessage(data) {
  if (!data) return null;
  return data;
}