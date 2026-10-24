// UI polish probe. Measures the state, focus-ring, hit-area and transition defects that screenshots miss.
// The file is one function expression with no dependencies. Run it in the page:
//   Playwright:          await page.evaluate(`(${source})(${JSON.stringify(options)})`)
//   Chrome DevTools MCP: evaluate_script with the file's text as the function
// options: { selector: limit the scan to elements inside this selector, limit: max elements (default 200) }
// It forces :hover, :focus-visible and :active by cloning same-origin rules onto marker classes, so read
// unreadableSheets: rules in cross-origin sheets are not forced. It restores focus, scroll and styles when done.
(options = {}) => {
  const INTERACTIVE = 'a[href], button, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), summary, label[for]';
  const VISIBLE = ['color', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderStyle', 'outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'textDecorationLine', 'textDecorationColor', 'opacity', 'transform', 'filter', 'content'];
  const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|border-width|font-size|line-height)/;
  const CLASS = { hover: '__uip-hover', 'focus-visible': '__uip-focus', focus: '__uip-focus', active: '__uip-active' };
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };
  const minTarget = matchMedia('(pointer: coarse)').matches ? 44 : 24;
  const root = options.selector ? document.querySelector(options.selector) : document;
  const findings = [], inserted = new Map(), focusedBefore = document.activeElement;
  let unreadableSheets = 0, elements = [];
  const label = el => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 3; n = n.parentElement) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      const same = n.parentElement ? [...n.parentElement.children].filter(c => c.tagName === n.tagName) : [];
      parts.unshift(n.tagName.toLowerCase() + (same.length > 1 ? `:nth-of-type(${same.indexOf(n) + 1})` : ''));
    }
    return parts.join(' > ');
  };
  // Never report what a user typed: form fields are named by their label, never by their value.
  const name = el => (el.getAttribute('aria-label') || el.labels?.[0]?.innerText || (el.matches('input, textarea, select') ? el.getAttribute('placeholder') : el.innerText) || '').trim().slice(0, 40);
  const add = (el, check, detail, unconfirmed) => findings.push({ selector: label(el), text: name(el), check, detail, ...(unconfirmed && { unconfirmed: true }) });

  // Clone every same-origin :hover / :focus-visible / :focus / :active rule onto a marker class.
  const clone = list => {
    for (let i = list.length - 1; i >= 0; i--) {
      const rule = list[i];
      if (rule instanceof CSSImportRule) { try { if (rule.styleSheet) clone(rule.styleSheet.cssRules); } catch { unreadableSheets++; } continue; }
      if (rule.cssRules) clone(rule.cssRules);
      if (!(rule instanceof CSSStyleRule) || !/:(hover|focus-visible|focus|active)(?![\w-])/.test(rule.selectorText)) continue;
      const selector = rule.selectorText.replace(/:(hover|focus-visible|focus|active)(?![\w-])/g, (_, p) => '.' + CLASS[p]);
      const parent = rule.parentRule ?? rule.parentStyleSheet;
      try { parent.insertRule(selector + rule.cssText.slice(rule.selectorText.length), i + 1); inserted.set(parent, (inserted.get(parent) ?? new Set()).add(parent.cssRules[i + 1])); } catch {}
    }
  };
  const freeze = document.createElement('style');
  freeze.textContent = '*, *::before, *::after { transition: none !important; animation-play-state: paused !important; }';

  const clips = s => /hidden|clip|auto|scroll/.test(s.overflow);
  // The part of an element a user can see: inside the viewport and every clipping ancestor.
  const visibleRect = el => {
    const r = el.getBoundingClientRect();
    let [left, top, right, bottom] = [Math.max(r.left, 0), Math.max(r.top, 0), Math.min(r.right, innerWidth), Math.min(r.bottom, innerHeight)];
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (!clips(getComputedStyle(p))) continue;
      const c = p.getBoundingClientRect();
      [left, top, right, bottom] = [Math.max(left, c.left), Math.max(top, c.top), Math.min(right, c.right), Math.min(bottom, c.bottom)];
    }
    return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
  };
  // Pseudo-elements count as the element's own feedback. Feedback drawn by a child is not read, so it is reported as unconfirmed.
  const read = el => [null, '::before', '::after'].map(p => getComputedStyle(el, p)).flatMap(s => VISIBLE.map(k => s[k])).join('|');
  // Layout boxes ignore transforms, so press feedback such as scale(0.97) does not count as movement.
  const rects = el => [el, el.parentElement, ...(el.parentElement?.children ?? [])].filter(Boolean).map(n => [n.offsetLeft, n.offsetTop, n.offsetWidth, n.offsetHeight]);
  const moved = (a, b) => a.some((r, i) => r.some((v, k) => v !== b[i][k]));
  const ancestors = el => { const list = []; for (let n = el; n; n = n.parentElement) list.push(n); return list; };
  const force = (el, state, on) => (state === 'focus' ? [el] : ancestors(el)).forEach(n => n.classList.toggle(CLASS[state], on));
  const rgb = c => { const m = c.match(/^rgba?\(([^)]+)\)$/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r, g, b, a }; };
  const over = (c, bg) => ({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 });
  const luminance = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // Composite translucent ancestor backgrounds down to the first opaque one, or white.
  const backdrop = el => {
    const layers = [];
    for (let n = el.parentElement; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c?.a > 0) { layers.push(c); if (c.a >= 1) break; } }
    return layers.reduceRight((bg, c) => over(c, bg), WHITE);
  };
  const painted = el => { const s = getComputedStyle(el); return (rgb(s.backgroundColor)?.a ?? 1) > 0 || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== 'none'; };
  const points = r => [0.1, 0.3, 0.5, 0.7, 0.9].flatMap(fx => [0.1, 0.5, 0.9].map(fy => ({ x: r.left + r.width * fx, y: r.top + r.height * fy, corner: fx !== 0.3 && fx !== 0.5 && fx !== 0.7 && fy !== 0.5 })));
  // Only a corner sample may land on an ancestor (a rounded corner); anywhere else the target itself must receive the hit.
  const owns = (el, hit, corner) => !hit || el.contains(hit) || hit.closest('label')?.control === el || el.control === hit || (corner && hit.contains(el));
  const foreign = (el, r) => points(r).map(p => [document.elementFromPoint(p.x, p.y), p.corner]).filter(([hit, corner]) => !owns(el, hit, corner)).map(([hit]) => hit);

  try {
    for (const sheet of document.styleSheets) { try { clone(sheet.cssRules); } catch { unreadableSheets++; } }

    // Record transitions and running animations before freezing motion for the measurements.
    const animated = new Map();
    for (const anim of document.getAnimations()) {
      const props = (anim.effect?.getKeyframes?.() ?? []).flatMap(k => Object.keys(k)).filter(p => LAYOUT.test(p.replace(/[A-Z]/g, c => '-' + c.toLowerCase())));
      if (props.length && anim.effect.target) animated.set(anim.effect.target, [...new Set(props)]);
    }
    elements = [...(root?.querySelectorAll(INTERACTIVE) ?? [])].filter(el => getComputedStyle(el).visibility !== 'hidden' && visibleRect(el)).slice(0, options.limit ?? 200);
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

    for (const el of elements) {
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true', hasChildren = el.children.length > 0;
      const rest = read(el), restRects = rects(el), r = el.getBoundingClientRect(), seen = visibleRect(el);

      // Hit area: size, covered parts, visual containers bigger than the target, labels that are not part of the target.
      const inlineLink = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && (el.parentElement?.innerText.length ?? 0) > el.innerText.length + 10;
      if (!inlineLink && (r.width < minTarget || r.height < minTarget)) add(el, 'small-target', `${Math.round(r.width)}x${Math.round(r.height)}px, minimum ${minTarget}px`);
      const missed = foreign(el, seen);
      if (missed.length) add(el, 'covered', `${missed.length}/15 sampled points hit ${label(missed[0])}`);
      for (let p = el.parentElement, depth = 0; p && p !== document.body && depth < 3; p = p.parentElement, depth++) {
        const pr = p.getBoundingClientRect(), share = (r.width * r.height) / (pr.width * pr.height);
        if (painted(p) && share < 0.8 && pr.width * pr.height < 40000 && p.querySelectorAll(INTERACTIVE).length === 1) { add(el, 'dead-zone', `painted container ${label(p)} is ${Math.round(pr.width)}x${Math.round(pr.height)}px, target is ${Math.round(r.width)}x${Math.round(r.height)}px`); break; }
      }
      if (/^(checkbox|radio)$/.test(el.type) && !el.labels?.length) add(el, 'unlabelled-control', 'no <label> shares this control\'s hit target');
      // Transparent padding that brings a control up to a 44px target is intended; a clickable box far beyond that is not.
      if (!painted(el) && getComputedStyle(el).display !== 'inline' && el.childNodes.length) {
        const range = document.createRange(); range.selectNodeContents(el); const c = range.getBoundingClientRect();
        const excess = Math.max(r.width - Math.max(c.width, 44), r.height - Math.max(c.height, 44));
        if (c.width && excess > 16) add(el, 'hit-leak', `clickable box is ${Math.round(r.width)}x${Math.round(r.height)}px around ${Math.round(c.width)}x${Math.round(c.height)}px of visible content`);
      }
      if (disabled) continue;

      // Hover, then press while hovered (as a real pointer does): each a visible change, with no layout movement.
      force(el, 'hover', true);
      const hover = read(el), hoverRects = rects(el);
      force(el, 'active', true);
      const press = read(el), pressRects = rects(el);
      force(el, 'active', false); force(el, 'hover', false);
      const childNote = hasChildren ? '; a child may draw the feedback, so confirm with real input' : '';
      if (hover === rest) add(el, 'no-hover-state', `no visible change on :hover${childNote}`, hasChildren);
      if (press === hover) add(el, 'no-active-state', `no visible change on :active${childNote}`, hasChildren);
      if (moved(restRects, hoverRects)) add(el, 'hover-moves-layout', ':hover changes the size or position of this element or a sibling');
      if (moved(hoverRects, pressRects)) add(el, 'active-moves-layout', ':active changes the size or position of this element or a sibling');

      // Focus: a visible ring that does not move layout, is not clipped or covered, and has 3:1 contrast.
      if (el.tabIndex < 0) continue;
      el.focus({ preventScroll: true, focusVisible: true });
      if (!el.matches(':focus-visible')) force(el, 'focus', true);
      const focused = read(el), fr = el.getBoundingClientRect(), fs = getComputedStyle(el);
      if (focused === rest) add(el, 'no-focus-ring', `no visible change on :focus-visible${childNote}`, hasChildren);
      if (moved(restRects, rects(el))) add(el, 'focus-moves-layout', 'focus changes the size or position of this element or a sibling');
      const ring = fs.outlineStyle !== 'none' ? parseFloat(fs.outlineWidth) + parseFloat(fs.outlineOffset) : 0;
      if (ring > 0 && fs.outlineStyle !== 'auto') {
        const ringColor = rgb(fs.outlineColor), bg = backdrop(el), ratio = ringColor && contrast(over(ringColor, bg), bg);
        if (!ringColor) add(el, 'focus-ring-unmeasured', `ring color ${fs.outlineColor} is not rgb(); check its contrast by eye`);
        else if (ratio < 3) add(el, 'focus-ring-contrast', `ring contrast ${ratio.toFixed(2)}:1 against its background, needs 3:1`);
      }
      for (let p = el.parentElement; p && p !== document.documentElement && ring > 0; p = p.parentElement) {
        const ps = getComputedStyle(p), pr = p.getBoundingClientRect();
        if (clips(ps) && (fr.left - ring < pr.left || fr.top - ring < pr.top || fr.right + ring > pr.right || fr.bottom + ring > pr.bottom)) { add(el, 'focus-ring-clipped', `ring is cut off by overflow: ${ps.overflow} on ${label(p)}`); break; }
      }
      const cover = foreign(el, seen).find(hit => ancestors(hit).some(n => /fixed|sticky/.test(getComputedStyle(n).position)));
      if (cover) add(el, 'focus-obscured', `focused element is covered by fixed or sticky ${label(cover)}`);
      force(el, 'focus', false); el.blur();
    }
  } finally {
    document.querySelectorAll(Object.values(CLASS).map(c => '.' + c).join(', ')).forEach(n => n.classList.remove(...Object.values(CLASS)));
    freeze.remove();
    for (const [parent, rules] of inserted) for (let i = parent.cssRules.length - 1; i >= 0; i--) if (rules.has(parent.cssRules[i])) parent.deleteRule(i);
    if (focusedBefore && focusedBefore !== document.body) focusedBefore.focus({ preventScroll: true });
    else document.activeElement?.blur();
  }

  // Layout shift around a real interaction: uiProbeShift.start() before it, uiProbeShift.stop() after. Separate evaluate calls work.
  let observer, shifts = [];
  window.uiProbeShift = {
    start() { shifts = []; observer = new PerformanceObserver(list => shifts.push(...list.getEntries())); observer.observe({ type: 'layout-shift' }); },
    stop() { shifts.push(...observer.takeRecords()); observer.disconnect(); return shifts.map(e => ({ value: e.value, sources: e.sources.map(s => s.node ? label(s.node) : '?') })); },
  };
  return { url: location.href, viewport: `${innerWidth}x${innerHeight}`, pointer: minTarget === 44 ? 'coarse' : 'fine', scanned: elements.length, unreadableSheets, findings };
}
