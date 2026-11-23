// Default-deny side-effect guard. Writes are answered in the browser; reads
// come from the adapter's fixtures, and an unanswered read is forwarded and
// logged `real`, which fails the run. Calls are logged by name only, as
// fixture, faked, failed, real, real-patched, allowed, session or error.
// Answers go out exactly as returned (false, null, 0, '' and [] included);
// only undefined means "no answer".

// The first answer that is not undefined (`a || b` would drop false, null, []).
export function firstDefined(...values) {
  for (const v of values) if (v !== undefined) return v
  return undefined
}

// A write's reply: the fake's answer, or `empty` when it gave none.
export const replyValue = (value, empty = {}) => (value === undefined ? empty : value)

const call = (fn, ...args) => (typeof fn === 'function' ? fn(...args) : undefined)

// Decide one socket call: { action: 'fail' | 'answer' | 'forward', how, value?, failure? }.
// Pure, so it can be unit tested.
export function decide(name, isRead, data, rules, extra) {
  const { journeyFakes = {}, fakes = {}, reads = {}, failures = {}, allowReal = [], patch = {} } = rules
  const fail = failures[name]
  if (fail) {
    const f = typeof fail === 'function' ? fail(data, extra) : fail === true ? {} : fail
    if (f) return { action: 'fail', how: 'failed', failure: f }
  }
  // Journey fakes win; undefined falls back to the adapter's.
  const value = firstDefined(call(journeyFakes[name], data, extra), call(isRead ? reads[name] : fakes[name], data, extra))
  if (value !== undefined) return { action: 'answer', how: isRead ? 'fixture' : 'faked', value }
  if (!isRead) return { action: 'answer', how: 'faked', value: undefined }
  return { action: 'forward', how: patch[name] ? 'real-patched' : allowReal.includes(name) ? 'allowed' : 'real' }
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Install the guard on a browser context. `rules` come from the adapter,
// `journey` holds the script's { fakes, rest, failures }, and `login` lets
// reads forward quietly and login.allow writes through.
export async function installGuard(context, { origins, rules = {}, journey = {}, login = null } = {}) {
  const log = []
  const note = (kind, name, how, more) => log.push({ at: new Date().toISOString(), kind, name, how, ...more })
  const quiet = new Set(rules.quiet || [])
  const tx = text => (rules.transform ? rules.transform(text) : text)
  const sockets = new Set()
  const proto = rules.socket
  const send = (ws, text) => { try { ws.send(text) } catch { /* socket closed */ } }
  const guard = {
    log,
    // Play a server event, e.g. a new message arriving.
    push: msg => { for (const ws of sockets) send(ws, typeof msg === 'string' ? msg : proto.encodePush(msg)) },
  }
  const base = {
    journeyFakes: journey.fakes, fakes: rules.writes, reads: rules.reads,
    failures: journey.failures, allowReal: rules.allowReal, patch: rules.patch,
  }
  const hostRe = origins.map(o => escapeRe(new URL(o).host)).join('|')

  if (proto) {
    await context.routeWebSocket(new RegExp(`^wss?://(${hostRe})/`), ws => {
      sockets.add(ws)
      const local = proto.localOnly?.(ws.url())
      const server = local ? null : ws.connectToServer()
      const toServer = raw => { try { server?.send(raw) } catch { /* closed */ } }
      // keepAlive may return a stop function, called when the socket closes.
      const stop = local ? null : proto.keepAlive?.(toServer)
      ws.onClose(() => { sockets.delete(ws); stop?.() })
      const pending = new Map()
      local && proto.onOpen?.(raw => send(ws, raw))
      ws.onMessage(raw => {
        const msg = proto.parse(raw)
        if (!msg) { note('ws', '(unparsed frame)', 'dropped'); return }
        // Frames the adapter answers itself (pings, keep-alives).
        const own = proto.answerLocally?.(msg)
        if (own !== undefined) { if (own !== null) send(ws, own); return }
        if (msg.id === undefined) return // fire-and-forget frame: never sent on
        const isRead = !!proto.isRead(msg.name)
        let d
        try { d = decide(msg.name, isRead, msg.data, base, { msg, guard }) } catch (e) { note('ws', msg.name, 'error', { error: String(e) }); d = { action: 'answer', how: 'faked' } }
        if (login && d.how === 'real') d = { action: 'forward', how: 'allowed' }
        if (d.action === 'forward' && !local) {
          if (d.how === 'real-patched') pending.set(msg.id, msg)
          if (!quiet.has(msg.name)) note('ws', msg.name, d.how)
          toServer(raw)
          return
        }
        if (d.action === 'fail') note('ws', msg.name, 'failed')
        else note('ws', msg.name, d.action === 'forward' ? 'faked' : d.how)
        const reply = d.action === 'fail' ? proto.encodeError(msg, d.failure) : proto.encodeReply(msg, replyValue(d.value, proto.empty ?? {}))
        setTimeout(() => send(ws, reply), 120)
      })
      server?.onMessage(raw => {
        const msg = proto.parse(raw)
        if (!msg) { send(ws, raw); return }
        // Server pushes (no id) are dropped unless the adapter passes them:
        // other activity on a shared server must not leak into a recording.
        if (msg.id === undefined) { if (proto.passPush?.(msg)) send(ws, raw); return }
        if (proto.dropReply?.(msg)) return
        const req = pending.get(msg.id)
        if (req) {
          pending.delete(msg.id)
          if (msg.ok) send(ws, tx(proto.encodeReply({ name: req.name, id: msg.id }, firstDefined(rules.patch[req.name](msg.data, req.data), msg.data))))
          else send(ws, tx(raw))
          return
        }
        send(ws, tx(raw))
      })
    })
  }

  const allow = new Set(login ? rules.loginAllow || [] : [])
  await context.route(new RegExp(`^https?://(${hostRe})/`), route => handleRest(route).catch(() => route.abort().catch(() => {})))
  async function handleRest(route) {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const key = `${req.method()} ${path}`
    const headers = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true' }
    if (req.method() === 'OPTIONS') return route.continue()
    if (allow.has(key)) { note('rest', key, 'session'); return route.continue() }
    const isRead = req.method() === 'GET' || req.method() === 'HEAD'
    // Failure mode: { status, body }, true (500), or a function of the request.
    const fail = journey.failures?.[key]
    const f = typeof fail === 'function' ? fail(req) : fail === true ? {} : fail
    if (f) {
      note('rest', key, 'failed', { status: f.status || 500 })
      return route.fulfill({ status: f.status || 500, contentType: 'application/json', headers, body: JSON.stringify(f.body ?? { error: 'Request failed' }) })
    }
    const handled = journey.rest?.[key] || rules.rest?.[key]
    if (handled) {
      // A handler may return { __status, ...body } to set the HTTP status.
      let out = firstDefined(await call(journey.rest?.[key], req), await call(rules.rest?.[key], req))
      if (out !== undefined) {
        note('rest', key, isRead ? 'fixture' : 'faked')
        let status = 200
        if (out && typeof out === 'object' && !Array.isArray(out) && out.__status) { status = out.__status; out = { ...out }; delete out.__status }
        return route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(out) })
      }
    }
    if (!isRead) {
      note('rest', key, 'faked')
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(replyValue(undefined, rules.restEmpty ?? {})) })
    }
    // Pages, scripts, styles, images and fonts are the app itself, not data.
    if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue()
    const patch = rules.restPatch?.[key]
    if (!login && !quiet.has(key)) note('rest', key, patch ? 'real-patched' : (rules.allowReal || []).includes(key) ? 'allowed' : 'real')
    if (!patch && !rules.transform) return route.continue()
    const res = await route.fetch()
    let body = await res.text()
    if (patch) try { body = JSON.stringify(firstDefined(patch(JSON.parse(body)), JSON.parse(body))) } catch { /* not JSON */ }
    return route.fulfill({ response: res, body: tx(body) })
  }

  return guard
}
