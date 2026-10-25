// UI polish probe. Measures the state, hover-quality, focus-ring, hit-area and transition defects that screenshots miss.
// The file is one function expression with no dependencies. Run it in the page:
//   Playwright:          await page.evaluate(`(${source})(${JSON.stringify(options)})`)
//   Chrome DevTools MCP: evaluate_script with the file's text as the function
// options: { selector: limit the scan to elements inside this selector, limit: max elements (default 200) }
// It forces :hover, :focus-visible and :active by cloning same-origin rules onto marker classes, so read
// unreadableSheets: rules in cross-origin sheets are not forced. It restores focus, scroll and styles when done.
(options = {}) => {
  const INTERACTIVE = 'a[href], button, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), summary, label[for]';
  const VISIBLE = ['color', 'backgroundColor', 'backgroundImage', 'borderColor', 'borderStyle', 'outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'textDecorationLine', 'textDecorationColor', 'opacity', 'transform', 'filter', 'content'];
  // Hover changes other than color, which faint-hover cannot measure.
  const FORM = VISIBLE.filter(k => !/^(color|backgroundColor|borderColor)$/.test(k));
  const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|border-width|font-size|line-height)/;
  const CLASS = { hover: '__uip-hover', 'focus-visible': '__uip-focus', focus: '__uip-focus', active: '__uip-active' };
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };
  const minTarget = matchMedia('(pointer: coarse)').matches ? 44 : 24;
  const root = options.selector ? document.querySelector(options.selector) : document;
  const findings = [], inserted = new Map(), focusedBefore = document.activeElement;
  // Focus handlers can scroll the page or a container, so every scroll position is put back at the end.
  const scrolls = [...document.querySelectorAll('*')].filter(n => n.scrollTop || n.scrollLeft || n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth).map(n => [n, n.scrollLeft, n.scrollTop]);
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
  const renders = (s, p) => !p || (s.display !== 'none' && !/^(none|normal)$/.test(s.content));
  const read = (el, keys = VISIBLE) => [null, '::before', '::after'].map(p => [getComputedStyle(el, p), p]).flatMap(([s, p]) => keys.map(k => renders(s, p) ? s[k] : '-')).join('|');
  const NAMES = ['', '::before ', '::after '].flatMap(p => VISIBLE.map(k => p + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())));
  // Layout boxes ignore transforms, so press feedback such as scale(0.97) does not count as movement.
  const rects = el => new Map([el, el.parentElement, ...(el.parentElement?.children ?? [])].filter(Boolean).map(n => [n, [n.offsetLeft, n.offsetTop, n.offsetWidth, n.offsetHeight]]));
  const moved = (a, b) => [...a].some(([n, r]) => b.has(n) && r.some((v, k) => v !== b.get(n)[k]));
  const ancestors = el => { const list = []; for (let n = el; n; n = n.parentElement) list.push(n); return list; };
  const force = (el, state, on) => (state === 'focus' ? [el] : ancestors(el)).forEach(n => n.classList.toggle(CLASS[state], on));
  const rgb = c => { const m = c.match(/^rgba?\(([^)]+)\)$/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r, g, b, a }; };
  const over = (c, bg) => ({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 });
  const linear = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const luminance = c => linear(c).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // CIELAB distance (ΔE76): about 2.3 is just noticeable side by side.
  const lab = c => {
    const [r, g, b] = linear(c), f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const [x, y, z] = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883].map(f);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
  // Composite translucent ancestor backgrounds down to the first opaque one, or white.
  const backdrop = el => {
    const layers = [];
    for (let n = el.parentElement; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c?.a > 0) { layers.push(c); if (c.a >= 1) break; } }
    return layers.reduceRight((bg, c) => over(c, bg), WHITE);
  };
  // What a pointer sees: own and pseudo-element backgrounds over the backdrop, then border and text over that fill.
  const look = el => {
    const s = getComputedStyle(el), layers = [s, getComputedStyle(el, '::before'), getComputedStyle(el, '::after')].filter((l, i) => renders(l, i));
    const fill = layers.reduce((bg, l) => { const c = rgb(l.backgroundColor); return c ? over(c, bg) : bg; }, backdrop(el));
    const border = parseFloat(s.borderTopWidth) > 0 && rgb(s.borderTopColor), text = el.textContent.trim() && rgb(s.color);
    return { fill, border: border && over(border, fill), text: text && over(text, fill), opacity: +s.opacity, own: layers.map(l => l.backgroundColor + l.backgroundImage).join('|') };
  };
  const radii = el => ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(k => parseFloat(getComputedStyle(el)[`border${k}Radius`]) || 0);
  const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  // The row a control sits in: the nearest interactive ancestor, or the outermost box of a cursor: pointer area.
  const rowOf = el => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (n.matches(INTERACTIVE) || (getComputedStyle(n).cursor === 'pointer' && getComputedStyle(n.parentElement).cursor !== 'pointer')) return n; };
  const GROUP = '[role=menu], [role=menubar], [role=toolbar], [role=listbox], [role=tablist], [role=tree], [role=grid], [role=radiogroup], [role=dialog], dialog, nav, ul, ol, menu, aside, header, footer';
  const painted = el => { const s = getComputedStyle(el); return (rgb(s.backgroundColor)?.a ?? 1) > 0 || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== 'none'; };
  const points = r => [0.1, 0.3, 0.5, 0.7, 0.9].flatMap(fx => [0.1, 0.5, 0.9].map(fy => ({ x: r.left + r.width * fx, y: r.top + r.height * fy, corner: fx !== 0.3 && fx !== 0.5 && fx !== 0.7 && fy !== 0.5 })));
  // Only a corner sample may land on an ancestor (a rounded corner); anywhere else the target itself must receive the hit.
  const owns = (el, hit, corner) => !hit || el.contains(hit) || hit.closest('label')?.control === el || el.control === hit || (corner && hit.contains(el));
  const foreign = (el, r) => points(r).map(p => [document.elementFromPoint(p.x, p.y), p.corner]).filter(([hit, corner]) => !owns(el, hit, corner)).map(([hit]) => hit);

  try {
    for (const sheet of document.styleSheets) { try { clone(sheet.cssRules); } catch { unreadableSheets++; } }

    // Record transitions and running animations before freezing motion for the measurements.
    const animated = new Map(), timing = new Map(), kinds = new Map();
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
      // Hover is seen tens of times a day: its color transition is quick and never eases in.
      const delays = s.transitionDelay.split(',').map(parseFloat), easings = s.transitionTimingFunction.split(/,(?![^(]*\))/).map(e => e.trim());
      const slow = s.transitionProperty.split(',').map(p => p.trim()).map((p, i) => [p, (durations[i % durations.length] + delays[i % delays.length]) * 1000, easings[i % easings.length]])
        .find(([p, ms, e]) => ms > 0 && /^(all|color|background|border|box-shadow|opacity|transform|filter|outline|text-decoration|fill|stroke)/.test(p) && (ms > 200 || e === 'ease-in'));
      timing.set(el, { transition: `${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`, cursor: s.cursor, slow });
    }
    document.head.append(freeze);

    for (const el of elements) {
      const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true', hasChildren = el.children.length > 0;
      const seen = visibleRect(el);
      if (!seen) continue; // an earlier control's focus handler hid or removed it
      const rest = read(el), restRects = rects(el), r = el.getBoundingClientRect();

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
      const restLook = look(el), restForm = read(el, FORM), row = rowOf(el), rowRest = row && look(row).own;
      let rowAlone;
      if (row) { force(row, 'hover', true); rowAlone = look(row).own; force(row, 'hover', false); }
      force(el, 'hover', true);
      const hover = read(el), hoverRects = rects(el), hoverLook = look(el), hoverForm = read(el, FORM), box = el.getBoundingClientRect(), rowLit = row && look(row).own !== rowRest;
      // Shape: a hover fill follows its rounded container (inset, concentric corners), stays inside clipping ancestors and off its neighbors.
      const fills = hoverLook.own !== restLook.own;
      const container = fills && ancestors(el).slice(1, -1).find(n => radii(n).some(v => v > 0));
      if (container) {
        const cs = getComputedStyle(container), c = container.getBoundingClientRect(), mine = radii(el), theirs = radii(container);
        const inset = [box.top - c.top - parseFloat(cs.borderTopWidth), c.right - parseFloat(cs.borderRightWidth) - box.right, c.bottom - parseFloat(cs.borderBottomWidth) - box.bottom, box.left - c.left - parseFloat(cs.borderLeftWidth)];
        const corner = [0, 1, 2, 3].find(i => { const [dx, dy] = [inset[i % 2 ? 1 : 3], inset[i < 2 ? 0 : 2]]; return dx > -1 && dy > -1 && dx < theirs[i] && dy < theirs[i] && mine[i] < theirs[i] - Math.max(dx, dy) - 1; });
        if (corner !== undefined) add(el, 'hover-shape', `hover fill's ${mine[corner]}px corner sits inside the ${theirs[corner]}px rounded corner of ${label(container)}, ${clips(cs) ? 'which clips it' : 'and pokes past it'}`);
        else if (Math.max(...mine) === 0 && ((Math.abs(inset[1]) <= 1 && Math.abs(inset[3]) <= 1) || (Math.abs(inset[0]) <= 1 && Math.abs(inset[2]) <= 1))) add(el, 'hover-shape', `hover fill is a square band edge to edge inside ${label(container)}, which has ${Math.max(...theirs)}px corners; inset and round it`);
      }
      if (fills || box.width > r.width || box.height > r.height) {
        const cut = ancestors(el).slice(1, -1).find(n => { const p = n.getBoundingClientRect(); return /hidden|clip/.test(getComputedStyle(n).overflow) && (box.left < p.left - 1 || box.top < p.top - 1 || box.right > p.right + 1 || box.bottom > p.bottom + 1); });
        if (cut) add(el, 'hover-clipped', `hovered box is cut off by overflow: ${getComputedStyle(cut).overflow} on ${label(cut)}`);
        const hit = [...(el.parentElement?.children ?? [])].find(n => n !== el && (n.matches(INTERACTIVE) || n.querySelector(INTERACTIVE)) && overlaps(box, n.getBoundingClientRect()) && !overlaps(r, n.getBoundingClientRect()));
        if (hit) add(el, 'hover-spills', `hovered box overlaps ${label(hit)}`);
      }
      force(el, 'active', true);
      const press = read(el), pressRects = rects(el);
      force(el, 'active', false); force(el, 'hover', false);
      const childNote = hasChildren ? '; a child may draw the feedback, so confirm with real input' : '';
      if (hover === rest) add(el, 'no-hover-state', `no visible change on :hover${childNote}`, hasChildren);
      else {
        // Quality of a hover that exists: visible, raising contrast, quick, one per pointer position, and the same as its siblings'.
        const change = Math.max(...['fill', 'border', 'text'].map(k => restLook[k] && hoverLook[k] ? deltaE(restLook[k], hoverLook[k]) : 0));
        if (hoverForm === restForm && change < 3) add(el, 'faint-hover', `hover changes color by ΔE ${change.toFixed(1)} at most; below 3 is hard to see`);
        const textBefore = restLook.text && contrast(restLook.text, restLook.fill), textAfter = hoverLook.text && contrast(hoverLook.text, hoverLook.fill);
        if (hoverLook.opacity < restLook.opacity) add(el, 'hover-fainter', `hover lowers opacity from ${restLook.opacity} to ${hoverLook.opacity}`);
        else if (textAfter < 4.5 && textAfter < textBefore) add(el, 'hover-fainter', `hover lowers text contrast from ${textBefore.toFixed(2)}:1 to ${textAfter.toFixed(2)}:1`);
        const { slow, transition, cursor } = timing.get(el);
        if (slow) add(el, 'hover-timing', `transition ${slow[0]} takes ${Math.round(slow[1])}ms with ${slow[2]}; hover wants 200ms or less, never ease-in`);
        if (rowLit && fills) add(el, 'doubled-hover', `hover fills both this control and its row ${label(row)}`);
        if (row && rowAlone !== rowRest && !rowLit) add(el, 'row-hover-lost', `row ${label(row)} has a hover fill that turns off while the pointer is on this control`);
        const restVals = rest.split('|'), changes = hover.split('|').map((v, i) => v !== restVals[i] && `${NAMES[i]}: ${v}`).filter(Boolean);
        const kind = `${el.getAttribute('role') ?? el.tagName.toLowerCase()}, ${Math.round(r.height)}px tall, in ${label(el.closest(GROUP) ?? el.parentElement)}`;
        const key = kind + JSON.stringify([restLook.fill, restLook.text]);
        kinds.set(key, [...(kinds.get(key) ?? []), { el, kind, parts: [...changes, `transition: ${transition}`, `cursor: ${cursor}`] }]);
      }
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
      const focusSeen = visibleRect(el), cover = focusSeen && foreign(el, focusSeen).find(hit => ancestors(hit).some(n => /fixed|sticky/.test(getComputedStyle(n).position)));
      if (cover) add(el, 'focus-obscured', `focused element is covered by fixed or sticky ${label(cover)}`);
      force(el, 'focus', false); el.blur();
    }
    // Controls of one kind (role, height, container and rest look) share one hover treatment; flag the minority.
    for (const group of kinds.values()) {
      const counts = new Map(group.map(g => g.parts.join('; ')).map((sig, _, all) => [sig, all.filter(s => s === sig).length]));
      const [common, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (group.length < 3 || n * 2 <= group.length) continue;
      const usual = common.split('; ');
      for (const g of group.filter(g => g.parts.join('; ') !== common)) add(g.el, 'inconsistent-hover', `${g.parts.filter(p => !usual.includes(p)).join('; ') || 'no change'} where ${n} of ${group.length} similar controls (${g.kind}) have ${usual.filter(p => !g.parts.includes(p)).join('; ') || 'no change'}`);
    }
  } finally {
    document.querySelectorAll(Object.values(CLASS).map(c => '.' + c).join(', ')).forEach(n => n.classList.remove(...Object.values(CLASS)));
    freeze.remove();
    for (const [parent, rules] of inserted) for (let i = parent.cssRules.length - 1; i >= 0; i--) if (rules.has(parent.cssRules[i])) parent.deleteRule(i);
    if (focusedBefore && focusedBefore !== document.body) focusedBefore.focus({ preventScroll: true });
    else document.activeElement?.blur();
    for (const [n, left, top] of scrolls) { n.scrollLeft = left; n.scrollTop = top; }
  }

  // Layout shift around a real interaction: uiProbeShift.start() before it, uiProbeShift.stop() after. Separate evaluate calls work.
  let observer, shifts = [];
  window.uiProbeShift = {
    start() { shifts = []; observer = new PerformanceObserver(list => shifts.push(...list.getEntries())); observer.observe({ type: 'layout-shift' }); },
    stop() { shifts.push(...observer.takeRecords()); observer.disconnect(); return shifts.map(e => ({ value: e.value, sources: e.sources.map(s => s.node ? label(s.node) : '?') })); },
  };
  // Controls that declare a menu, listbox, dialog or disclosure: surfaces to open and probe. Right-click menus are not declared.
  const opens = elements.filter(el => el.isConnected && el.matches('[aria-haspopup]:not([aria-haspopup=false]), [aria-expanded]')).map(el => ({ selector: label(el), text: name(el), opens: el.getAttribute('aria-haspopup') ?? 'disclosure', expanded: el.getAttribute('aria-expanded') === 'true' }));
  return { url: location.href, viewport: `${innerWidth}x${innerHeight}`, pointer: minTarget === 44 ? 'coarse' : 'fine', scanned: elements.length, unreadableSheets, opens, findings };
}
