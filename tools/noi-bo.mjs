#!/usr/bin/env node
/*
 * Mã hoá nội dung trang nội bộ (noi-bo.html) bằng AES-GCM 128.
 * Khoá chỉ nằm trong phần #k=... của link (không gửi lên máy chủ, không lưu trên GitHub).
 *
 *   Mã hoá (tạo khoá mới):   node tools/noi-bo.mjs ma-hoa _rieng/team2.json
 *   Mã hoá (giữ khoá cũ):     node tools/noi-bo.mjs ma-hoa _rieng/team2.json <khoá>
 *   Giải mã để sửa nội dung:  node tools/noi-bo.mjs giai-ma <khoá> > _rieng/team2.json
 *
 * Giữ khoá cũ thì link + QR đã phát cho team vẫn dùng được.
 */
import { webcrypto as wc } from 'node:crypto';
import fs from 'node:fs';

const OUT = new URL('../data/noi-bo.json', import.meta.url);
const SITE = 'https://anhtrainhadat-cmyk.github.io/pickleball-giai-dau/noi-bo.html';
const b64 = (u8) => Buffer.from(u8).toString('base64');
const b64u = (u8) => Buffer.from(u8).toString('base64url');
const importKey = (k) => wc.subtle.importKey('raw', Buffer.from(k, 'base64url'), 'AES-GCM', false, ['encrypt', 'decrypt']);

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'ma-hoa' && a) {
  const json = JSON.stringify(JSON.parse(fs.readFileSync(a, 'utf8')));
  const k = b || b64u(wc.getRandomValues(new Uint8Array(16)));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await wc.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(k), new TextEncoder().encode(json)));
  fs.writeFileSync(OUT, JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) }) + '\n');
  console.error('Đã ghi data/noi-bo.json');
  console.log(SITE + '#k=' + k);
} else if (cmd === 'giai-ma' && a) {
  const e = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const pt = await wc.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(e.iv, 'base64') }, await importKey(a), Buffer.from(e.ct, 'base64'));
  console.log(JSON.stringify(JSON.parse(new TextDecoder().decode(pt)), null, 2));
} else {
  console.error('Cách dùng: node tools/noi-bo.mjs ma-hoa <nội-dung.json> [khoá] | giai-ma <khoá>');
  process.exit(1);
}
