#!/usr/bin/env node
// Google Calendar: timed events between the cutoff and now, across every calendar the
// connected account can read. All-day entries are skipped.
//
//   node calendar.mjs [--since ISO]
import {options, composioAccounts, composio, emit} from './lib.mjs';

const opt = options();
for (const account of await composioAccounts('googlecalendar')) {
  const data = await composio('GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS', {time_min: opt.since.toISOString(), time_max: new Date().toISOString()}, account);
  for (const e of data?.summary_view ?? []) {
    if (e.is_all_day) continue;
    emit({time: new Date(e.start).toISOString(), source: 'calendar', actor: e.calendar, what: `Meeting: ${e.title ?? '(untitled)'}`, link: e.display_url});
  }
}
