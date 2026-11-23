#!/usr/bin/env node
// GitHub: what the person did since the cutoff, from their activity feed: pull requests
// opened, merged or closed, reviews, review comments (counted per PR), and issues opened
// or closed. Titles come from one GraphQL lookup.
//
//   node github.mjs [--since ISO] [--person LOGIN]   (default: the gh login)
import {options, run, runJson, emit, note} from './lib.mjs';

const opt = options();
const login = /^[\w-]+$/.test(opt.person ?? '') ? opt.person : (await run('gh', ['api', 'user', '--jq', '.login'])).stdout.trim();
if (!login) { note('gh is not signed in; run gh auth login'); process.exit(0); }
const since = opt.since.toISOString();

const events = [];
for (let page = 1; page <= 3; page++) {
  const batch = await runJson('gh', ['api', `/users/${login}/events?per_page=100&page=${page}`]) ?? [];
  events.push(...batch.filter(e => e.created_at >= since));
  if (batch.length < 100 || batch.at(-1).created_at < since) break;
}

const key = (repo, n) => `${repo}#${n}`;
const acts = [], comments = new Map();
for (const e of events) {
  const repo = e.repo.name, p = e.payload;
  const n = p.pull_request?.number ?? p.issue?.number ?? p.number;
  const kind = p.pull_request || e.type.startsWith('PullRequest') ? 'pr' : 'issue';
  const act = e.type === 'PullRequestEvent' && ['opened', 'merged', 'closed', 'reopened'].includes(p.action) ? p.action
    : e.type === 'PullRequestReviewEvent' ? `reviewed${p.review?.state ? ` (${p.review.state.toLowerCase()})` : ''}`
    : e.type === 'IssuesEvent' && ['opened', 'closed'].includes(p.action) ? `${p.action} issue`
    : null;
  if (act) acts.push({time: e.created_at, repo, n, kind, act});
  else if (e.type === 'PullRequestReviewCommentEvent' || e.type === 'IssueCommentEvent') {
    const k = key(repo, n), c = comments.get(k) ?? {time: e.created_at, repo, n, kind, count: 0};
    c.count++; if (e.created_at < c.time) c.time = e.created_at;
    comments.set(k, c);
  }
}

// One GraphQL call for every title.
const targets = [...new Map([...acts, ...comments.values()].map(a => [key(a.repo, a.n), a])).values()];
const titles = new Map();
if (targets.length) {
  const q = targets.map((a, i) => { const [owner, name] = a.repo.split('/'); return `t${i}: repository(owner: "${owner}", name: "${name}") { issueOrPullRequest(number: ${a.n}) { ... on PullRequest { title url } ... on Issue { title url } } }`; }).join('\n');
  const r = await runJson('gh', ['api', 'graphql', '-f', `query={${q}}`]);
  targets.forEach((a, i) => titles.set(key(a.repo, a.n), r?.data?.[`t${i}`]?.issueOrPullRequest ?? {}));
}

const label = a => { const t = titles.get(key(a.repo, a.n)) ?? {}; return {title: t.title ?? `${a.repo}#${a.n}`, url: t.url ?? `https://github.com/${a.repo}/${a.kind === 'pr' ? 'pull' : 'issues'}/${a.n}`}; };
for (const a of acts) { const {title, url} = label(a); emit({time: a.time, source: 'github', actor: login, what: `${a.repo.split('/')[1]}: ${a.act} "${title}"`, link: url}); }
for (const c of comments.values()) { const {title, url} = label(c); emit({time: c.time, source: 'github', actor: login, what: `${c.repo.split('/')[1]}: ${c.count} comment${c.count > 1 ? 's' : ''} on "${title}"`, link: url}); }
