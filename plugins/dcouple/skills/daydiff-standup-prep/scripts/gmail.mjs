#!/usr/bin/env node
// Gmail: messages sent since the cutoff, from every active Composio Gmail account.
// Emits recipient and subject only; message bodies are never read.
//
//   node gmail.mjs [--since ISO]
import {options, composioAccounts, composio, emit, mapLimit} from './lib.mjs';

const opt = options();
const after = Math.floor(opt.since.getTime() / 1000);
const name = to => String(to ?? '').split(',')[0].split('<')[0].replace(/[>"]/g, '').trim() || 'someone';

await mapLimit(await composioAccounts('gmail'), 3, async account => {
  for (let page_token; ;) {
    const data = await composio('GMAIL_FETCH_EMAILS', {query: `in:sent after:${after}`, max_results: 100, include_payload: false, verbose: false, ...(page_token ? {page_token} : {})}, account);
    for (const m of data?.messages ?? []) emit({time: m.messageTimestamp, source: 'gmail', actor: account, what: `Emailed ${name(m.to)}: ${m.subject ?? '(no subject)'}`, link: m.display_url});
    page_token = data?.nextPageToken;
    if (!page_token) break;
  }
});
