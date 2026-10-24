// UI polish probe. Measures the state, focus-ring, hit-area and transition defects that screenshots miss.
// The file is one function expression with no dependencies. Run it in the page:
//   Playwright:          await page.evaluate(`(${source})(${JSON.stringify(options)})`)
//   Chrome DevTools MCP: evaluate_script with the file's text as the function
// options: { selector: limit the scan to elements inside this selector, limit: max elements (default 200) }
// It forces :hover, :focus-visible and :active by cloning same-origin rules onto marker classes, so read
// unreadableSheets: rules in cross-origin sheets are not forced. It cleans up after itself.
(options = {}) => {
  const INTERACTIVE = 'a[href], button, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), summary, label[for]';
  const VISIBLE = ['color', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderStyle', 'outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'textDecorationLine', 'textDecorationColor', 'opacity', 'transform', 'filter'];
  const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|border-width|font-size|line-height)/;
  const CLASS = { hover: '__uip-hover', 'focus-visible': '__uip-focus', focus: '__uip-focus', active: '__uip-active' };
  const minTarget = matchMedia('(pointer: coarse)').matches ? 44 : 24;
  const findings = [], inserted = [];
  let unreadableSheets = 0;
  const label = el => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 3; n = n.parentElement) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      const same = n.parentElement ? [...n.parentElement.children].filter(c => c.tagName === n.tagName) : [];
      parts.unshift(n.tagName.toLowerCase() + (same.length > 1 ? `:nth-of-type(${same.indexOf(n) + 1})` : ''));
    }
    return parts.join(' > ');
  };
  const add = (el, check, detail) => findings.push({ selector: label(el), text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40), check, detail });

  // Clone every same-origin :hover / :focus-visible / :focus / :active rule onto a marker class.
  const clone = list => {
    for (let i = list.length - 1; i >= 0; i--) {
      const rule = list[i];
      if (rule.cssRules) clone(rule.cssRules);
      if (!(rule instanceof CSSStyleRule) || !/:(hover|focus-visible|focus|active)(?![\w-])/.test(rule.selectorText)) continue;
      const selector = rule.selectorText.replace(/:(hover|focus-visible|focus|active)(?![\w-])/g, (_, p) => '.' + CLASS[p]);
      const parent = rule.parentRule ?? rule.parentStyleSheet;
      try { parent.insertRule(selector + rule.cssText.slice(rule.selectorText.length), i + 1); inserted.push([parent, parent.cssRules[i + 1]]); } catch {}
    }
  };
  for (const sheet of document.styleSheets) { try { clone(sheet.cssRules); } catch { unreadableSheets++; } }

  // Record transitions and running animations before freezing motion for the measurements.
  const animated = new Map();
  for (const anim of document.getAnimations()) {
    const props = (anim.effect?.getKeyframes?.() ?? []).flatMap(k => Object.keys(k)).filter(p => LAYOUT.test(p.replace(/[A-Z]/g, c => '-' + c.toLowerCase())));
    if (props.length && anim.effect.target) animated.set(anim.effect.target, [...new Set(props)]);
  }
  const freeze = document.createElement('style');
  freeze.textContent = '*, *::before, *::after { transition: none !important; animation-play-state: paused !important; }';

  const root = options.selector ? document.querySelector(options.selector) : document;
  const scroll = [scrollX, scrollY];
  const elements = [...(root?.querySelectorAll(INTERACTIVE) ?? [])].filter(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }).slice(0, options.limit ?? 200);

  for (const el of elements) {
    const s = getComputedStyle(el), durations = s.transitionDuration.split(',').map(parseFloat);
    s.transitionProperty.split(',').map(p => p.trim()).forEach((p, i) => {
      if (!(durations[i % durations.length] > 0)) return;
      if (p === 'all') add(el, 'transition-all', `transition: all ${s.transitionDuration}`);
      else if (LAYOUT.test(p)) add(el, 'animates-layout', `transitions ${p}`);
    });
    if (animated.has(el)) add(el, 'animates-layout', `animation keyframes change ${animated.get(el).join(', ')}`);
  }
  document.head.append(freeze);

  const read = el => { const s = getComputedStyle(el); return Object.fromEntries(VISIBLE.map(p => [p, s[p]])); };
  const changed = (a, b) => VISIBLE.filter(p => a[p] !== b[p]);
  // Layout boxes ignore transforms, so press feedback such as scale(0.97) does not count as movement.
  const rects = el => [el, el.parentElement, ...(el.parentElement?.children ?? [])].filter(Boolean).map(n => [n.offsetLeft, n.offsetTop, n.offsetWidth, n.offsetHeight]);
  const moved = (a, b) => a.some((r, i) => r.some((v, k) => v !== b[i][k]));
  const ancestors = el => { const list = []; for (let n = el; n; n = n.parentElement) list.push(n); return list; };
  const force = (el, state, on) => (state === 'focus' ? [el] : ancestors(el)).forEach(n => n.classList.toggle(CLASS[state], on));
  const rgb = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r, g, b, a }; };
  const luminance = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const backdrop = el => { for (let n = el.parentElement; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const painted = el => { const s = getComputedStyle(el); return (rgb(s.backgroundColor)?.a ?? 1) > 0 || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== 'none'; };
  const points = r => [0.1, 0.3, 0.5, 0.7, 0.9].flatMap(fx => [0.1, 0.5, 0.9].map(fy => [r.left + r.width * fx, r.top + r.height * fy]))
    .filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
  // A hit on an ancestor means the point missed a rounded corner, not that something covers the target.
  const owns = (el, hit) => !hit || hit.contains(el) || el.contains(hit) || hit.closest('label')?.control === el || el.control === hit;

  for (const el of elements) {
    const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
    const rest = read(el), restRects = rects(el), r = el.getBoundingClientRect();

    // Hit area: size, covered parts, visual containers bigger than the target, labels that are not part of the target.
    const inlineLink = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && (el.parentElement?.innerText.length ?? 0) > el.innerText.length + 10;
    if (!inlineLink && (r.width < minTarget || r.height < minTarget)) add(el, 'small-target', `${Math.round(r.width)}x${Math.round(r.height)}px, minimum ${minTarget}px`);
    const samples = points(r), foreign = samples.map(([x, y]) => document.elementFromPoint(x, y)).filter(hit => !owns(el, hit));
    if (samples.length && foreign.length) add(el, 'covered', `${foreign.length}/${samples.length} sampled points hit ${label(foreign[0])}`);
    for (let p = el.parentElement, depth = 0; p && p !== document.body && depth < 3; p = p.parentElement, depth++) {
      const pr = p.getBoundingClientRect(), share = (r.width * r.height) / (pr.width * pr.height);
      if (painted(p) && share < 0.8 && pr.width * pr.height < 40000 && p.querySelectorAll(INTERACTIVE).length === 1) { add(el, 'dead-zone', `painted container ${label(p)} is ${Math.round(pr.width)}x${Math.round(pr.height)}px, target is ${Math.round(r.width)}x${Math.round(r.height)}px`); break; }
    }
    if (/^(checkbox|radio)$/.test(el.type) && !el.labels?.length) add(el, 'unlabelled-control', 'no <label> shares this control\'s hit target');
    if (!painted(el) && getComputedStyle(el).display !== 'inline' && el.childNodes.length) {
      const range = document.createRange(); range.selectNodeContents(el); const c = range.getBoundingClientRect();
      const leak = Math.max(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom);
      if (c.width && leak > 8) add(el, 'hit-leak', `clickable box extends ${Math.round(leak)}px past the visible content`);
    }
    if (disabled) continue;

    // Hover and press: a visible change, and no layout movement.
    for (const state of ['hover', 'active']) {
      force(el, state, true);
      const now = read(el), nowRects = rects(el);
      force(el, state, false);
      if (!changed(rest, now).length) add(el, `no-${state}-state`, `no visible change on :${state}`);
      if (moved(restRects, nowRects)) add(el, `${state}-moves-layout`, `:${state} changes the size or position of this element or a sibling`);
    }

    // Focus: a visible ring that is not clipped, not covered by fixed or sticky elements, and has 3:1 contrast.
    if (el.tabIndex < 0) continue;
    el.focus({ focusVisible: true });
    if (!el.matches(':focus-visible')) force(el, 'focus', true);
    const focused = read(el), fr = el.getBoundingClientRect(), fs = getComputedStyle(el);
    if (!changed(rest, focused).length) add(el, 'no-focus-ring', 'no visible change on :focus-visible');
    if (Math.abs(fr.width - r.width) > 0.5 || Math.abs(fr.height - r.height) > 0.5) add(el, 'focus-moves-layout', 'focus changes the element size');
    const ring = fs.outlineStyle !== 'none' ? parseFloat(fs.outlineWidth) + parseFloat(fs.outlineOffset) : 0;
    const ringColor = rgb(fs.outlineColor);
    if (ring > 0 && fs.outlineStyle !== 'auto' && ringColor && contrast(ringColor, backdrop(el)) < 3) add(el, 'focus-ring-contrast', `ring contrast ${contrast(ringColor, backdrop(el)).toFixed(2)}:1 against its background, needs 3:1`);
    for (let p = el.parentElement; p && p !== document.documentElement && ring > 0; p = p.parentElement) {
      const ps = getComputedStyle(p), pr = p.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(ps.overflow) && (fr.left - ring < pr.left || fr.top - ring < pr.top || fr.right + ring > pr.right || fr.bottom + ring > pr.bottom)) { add(el, 'focus-ring-clipped', `ring is cut off by overflow: ${ps.overflow} on ${label(p)}`); break; }
    }
    const cover = points(fr).map(([x, y]) => document.elementFromPoint(x, y)).find(hit => !owns(el, hit) && ancestors(hit).some(n => /fixed|sticky/.test(getComputedStyle(n).position)));
    if (cover) add(el, 'focus-obscured', `focused element is covered by fixed or sticky ${label(cover)}`);
    force(el, 'focus', false); el.blur(); scrollTo(...scroll);
  }

  freeze.remove();
  for (const [parent, rule] of inserted.reverse()) { const i = [...parent.cssRules].indexOf(rule); if (i >= 0) parent.deleteRule(i); }

  // Layout shift around a real interaction: uiProbeShift.start() before it, uiProbeShift.stop() after. Separate evaluate calls work.
  let observer, shifts = [];
  window.uiProbeShift = {
    start() { shifts = []; observer = new PerformanceObserver(list => shifts.push(...list.getEntries())); observer.observe({ type: 'layout-shift' }); },
    stop() { shifts.push(...observer.takeRecords()); observer.disconnect(); return shifts.map(e => ({ value: e.value, sources: e.sources.map(s => s.node ? label(s.node) : '?') })); },
  };
  return { url: location.href, viewport: `${innerWidth}x${innerHeight}`, pointer: minTarget === 44 ? 'coarse' : 'fine', scanned: elements.length, unreadableSheets, findings };
}
