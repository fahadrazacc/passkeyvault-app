// Quick checks for the security-critical helpers. Run with `npm test`.
import assert from 'node:assert/strict';
import { hotp, parseTotp, totpNow, base32Decode } from '../src/totp';
import { generate, randomPassword, passphrase, randInt } from '../src/generator';
import { DEFAULT_GEN } from '../src/generator';
import { estimate } from '../src/strength';
import { importCsv, parseCsv } from '../src/importer';
import { WORDS } from '../src/wordlist';

let n = 0;
const ok = (name: string) => console.log(`  ✓ ${name}`, ++n);

// RFC 4226 appendix D test vectors (secret "12345678901234567890")
const secret = new TextEncoder().encode('12345678901234567890');
const rfc4226 = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
for (let i = 0; i < 10; i++) assert.equal(await hotp({ secret, digits: 6, algorithm: 'SHA-1' }, i), rfc4226[i]);
ok('HOTP matches RFC 4226 vectors');

// RFC 6238 appendix B (SHA-1, 8 digits)
const t = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']] as const;
for (const [sec, code] of t) assert.equal((await totpNow({ secret, digits: 8, period: 30, algorithm: 'SHA-1' }, sec * 1000)).code, code);
// SHA-256 / SHA-512 vectors use longer seeds
const s256 = new TextEncoder().encode('12345678901234567890123456789012');
const s512 = new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234');
assert.equal((await totpNow({ secret: s256, digits: 8, period: 30, algorithm: 'SHA-256' }, 59000)).code, '46119246');
assert.equal((await totpNow({ secret: s512, digits: 8, period: 30, algorithm: 'SHA-512' }, 59000)).code, '90693936');
ok('TOTP matches RFC 6238 vectors (SHA-1/256/512)');

assert.deepEqual([...base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')], [...secret]);
const spec = parseTotp('otpauth://totp/GitHub:fahad%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=GitHub&digits=6&period=30');
assert.equal(spec.issuer, 'GitHub');
assert.equal(spec.account, 'fahad@example.com');
assert.throws(() => parseTotp('not a key!'));
ok('base32 + otpauth parsing');

for (let i = 0; i < 200; i++) {
  const p = randomPassword({ ...DEFAULT_GEN, length: 16 });
  assert.equal(p.length, 16);
  assert.match(p, /[A-Z]/);
  assert.match(p, /[a-z]/);
  assert.match(p, /\d/);
  assert.match(p, /[^A-Za-z0-9]/);
}
assert.doesNotMatch(randomPassword({ ...DEFAULT_GEN, length: 64, avoidAmbiguous: true }), /[Il1O0o]/);
assert.equal(passphrase({ ...DEFAULT_GEN, words: 5, separator: '-', includeNumber: false }).split('-').length, 5);
assert.match(generate({ ...DEFAULT_GEN, mode: 'pin', pinLength: 6 }), /^\d{6}$/);
const counts = new Array(10).fill(0);
for (let i = 0; i < 20000; i++) counts[randInt(10)]++;
assert.ok(counts.every((c) => c > 1700 && c < 2300), 'randInt is roughly uniform');
assert.equal(WORDS.length, 7776);
ok('generator: all character sets, look-alikes, passphrase, PIN, uniform');

assert.ok(estimate('password').level === 0);
assert.ok(estimate('Pakistan123').level <= 1);
assert.ok(estimate('qwerty2024!').level <= 1);
assert.ok(estimate('Correct-Horse-Battery-Staple-42').level >= 3);
assert.ok(estimate('vK7#9qLm$Tz24wRx!').level === 4);
ok('strength estimates');

assert.deepEqual(parseCsv('a,b\n"x, ""y""","line1\nline2"\n'), [['a', 'b'], ['x, "y"', 'line1\nline2']]);
const lp = `url,username,password,totp,extra,name,grouping,fav
https://github.com/login,fahad@integrow.com,s3cret!,JBSWY3DPEHPK3PXP,,GitHub,Work,1
http://sn,,,,"NoteType:Credit Card
Name on Card:Fahad Raza
Type:
Number:4111111111111111
Security Code:123
Start Date:,
Expiration Date:January,2029
Notes:",Visa,Banking,0
http://sn,,,,My secret note text,Note A,,0
`;
const r = importCsv(lp, 1);
assert.equal(r.source, 'LastPass');
assert.equal(r.items.length, 3);
assert.equal(r.items[0].type, 'login');
assert.equal(r.items[0].folder, 'Work');
assert.equal(r.items[0].favorite, true);
assert.equal(r.items[0].totp, 'JBSWY3DPEHPK3PXP');
assert.equal(r.items[1].type, 'card');
assert.equal(r.items[1].cardNumber, '4111111111111111');
assert.equal(r.items[1].expiry, '01/29');
assert.equal(r.items[2].type, 'note');
const chrome = importCsv('name,url,username,password,note\nexample.com,https://example.com/,me,pw1,\n');
assert.equal(chrome.items[0].title, 'example.com');
assert.equal(chrome.items[0].password, 'pw1');
ok('CSV import: LastPass logins, cards, notes; Chrome format');

const { createVault, openVault, checkPassword, exportBackup, openBackup, changePassword } = await import('../src/vault');
const { emptyData } = await import('../src/utils');
const d = emptyData('Fahad');
d.items.push({ id: 'a', type: 'login', title: 'Test', password: 'hunter2', createdAt: 1, updatedAt: 1 });
await createVault('correct horse battery', d);
assert.equal((await openVault('correct horse battery')).data.items[0].password, 'hunter2');
assert.equal(await checkPassword('wrong password'), false);
const bk = exportBackup()!;
assert.ok(!bk.includes('hunter2'), 'backup is encrypted');
assert.equal((await openBackup(bk, 'correct horse battery')).data.settings.name, 'Fahad');
await changePassword('new master pass 99', d);
assert.equal(await checkPassword('correct horse battery'), false);
assert.equal(await checkPassword('new master pass 99'), true);
ok('vault: encrypt, unlock, wrong password, encrypted backup, change password');

console.log(`\nAll ${n} groups passed.`);
