import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditHost, detectLanguage, formatReport, isBlocked, parseHostList } from './audit.ts';

// A fake DSM Web API, enough for login, feed list/delete, package list, logout.
function fakeDsm(initialFeeds: { name: string; feed: string }[], options: { password?: string } = {}) {
  let feeds = [...initialFeeds];
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const params = new URLSearchParams(String(init?.body ?? ''));
    const api = params.get('api');
    const method = params.get('method');
    calls.push(`${api}.${method}`);
    const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
    const fail = (code: number) => new Response(JSON.stringify({ success: false, error: { code } }), { status: 200 });
    if (url.endsWith('/webapi/query.cgi')) {
      return ok({
        'SYNO.API.Auth': { path: 'entry.cgi', minVersion: 1, maxVersion: 7 },
        'SYNO.Core.Package': { path: 'entry.cgi', minVersion: 1, maxVersion: 2 },
        'SYNO.Core.Package.Feed': { path: 'entry.cgi', minVersion: 1, maxVersion: 1 },
      });
    }
    if (api === 'SYNO.API.Auth' && method === 'login') {
      assert.equal(params.get('version'), '6');
      return params.get('passwd') === (options.password ?? 'secret') ? ok({ sid: 'SID1' }) : fail(400);
    }
    if (params.get('_sid') !== 'SID1') return fail(119);
    if (api === 'SYNO.API.Auth' && method === 'logout') return ok({});
    if (api === 'SYNO.Core.Package.Feed' && method === 'list') return ok({ items: feeds, total: feeds.length });
    if (api === 'SYNO.Core.Package.Feed' && method === 'delete') {
      const remove = JSON.parse(params.get('list') ?? '[]') as string[];
      feeds = feeds.filter((f) => !remove.includes(f.feed));
      return ok({});
    }
    if (api === 'SYNO.Core.Package' && method === 'list') {
      return ok({ packages: [
        { id: 'zerotier', version: '1.14.2', additional: { status: 'stop' } },
        { id: 'HyperBackup', version: '4.1.2-3824', additional: { status: 'running' } },
      ] });
    }
    return fail(103);
  }) as typeof fetch;
  return { impl, calls, feeds: () => feeds };
}

const IMNKS = { name: '矿神', feed: 'https://spk7.imnks.com/' };
const SYNOCOMMUNITY = { name: 'SynoCommunity', feed: 'https://packages.synocommunity.com/' };

test('flags imnks hosts only', () => {
  assert.ok(isBlocked('https://spk7.imnks.com/'));
  assert.ok(isBlocked('http://spk.imnks.com'));
  assert.ok(isBlocked('https://IMNKS.com/'));
  assert.ok(!isBlocked('https://packages.synocommunity.com/'));
  assert.ok(!isBlocked('https://notimnks.com/'));
  assert.ok(!isBlocked('not a url'));
});

test('audit is read-only by default and reports sources and packages', async () => {
  const dsm = fakeDsm([IMNKS, SYNOCOMMUNITY]);
  const report = await auditHost('http://nas:5000/', { user: 'admin', password: 'secret' }, { fetchImpl: dsm.impl });
  assert.equal(report.ok, true);
  assert.deepEqual(report.blockedFeeds, [IMNKS]);
  assert.deepEqual(report.removed, []);
  assert.equal(dsm.feeds().length, 2);
  assert.ok(!dsm.calls.includes('SYNO.Core.Package.Feed.delete'));
  assert.ok(dsm.calls.at(-1) === 'SYNO.API.Auth.logout');
  const text = formatReport(report);
  assert.match(text, /closed\/untrusted sources: https:\/\/spk7\.imnks\.com\//);
  assert.match(text, /zerotier: 1\.14\.2 \(stop\)/);
});

test('--remove deletes only blocked sources and confirms it', async () => {
  const dsm = fakeDsm([IMNKS, SYNOCOMMUNITY]);
  const report = await auditHost('http://nas:5000', { user: 'admin', password: 'secret' }, { remove: true, fetchImpl: dsm.impl });
  assert.deepEqual(report.removed, ['https://spk7.imnks.com/']);
  assert.deepEqual(dsm.feeds(), [SYNOCOMMUNITY]);
  assert.match(formatReport(report), /REMOVED: https:\/\/spk7\.imnks\.com\//);
});

test('wrong password is reported, not thrown', async () => {
  const dsm = fakeDsm([IMNKS]);
  const report = await auditHost('http://nas:5000', { user: 'admin', password: 'nope' }, { fetchImpl: dsm.impl });
  assert.equal(report.ok, false);
  assert.match(report.error ?? '', /DSM error 400/);
  assert.match(formatReport(report), /ERROR/);
});

test('report speaks Italian when asked, language follows the locale', async () => {
  const dsm = fakeDsm([IMNKS]);
  const report = await auditHost('http://nas:5000', { user: 'admin', password: 'secret' }, { remove: true, fetchImpl: dsm.impl });
  const text = formatReport(report, 'it');
  assert.match(text, /sorgenti chiuse\/non affidabili: https:\/\/spk7\.imnks\.com\//);
  assert.match(text, /RIMOSSE: https:\/\/spk7\.imnks\.com\//);
  assert.match(text, /pacchetti: zerotier 1\.14\.2 \[stop\]/);
  assert.equal(detectLanguage({ AUDIT_LANG: 'it' }), 'it');
  assert.equal(detectLanguage({ LANG: 'it_IT.UTF-8' }), 'it');
  assert.equal(detectLanguage({ AUDIT_LANG: 'en', LANG: 'it_IT.UTF-8' }), 'en');
  assert.equal(detectLanguage({ LC_ALL: 'en_US.UTF-8' }), 'en');
});

test('host list ignores comments and blanks', () => {
  assert.deepEqual(parseHostList('# fleet\nhttp://a:5000\n\n  https://b:5001  # office\n'), ['http://a:5000', 'https://b:5001']);
});
