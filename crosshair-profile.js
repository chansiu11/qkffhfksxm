/* Valorant-style crosshair profile import for the web game.
 * This parser intentionally accepts the game's share-code syntax as a visual
 * configuration; it never modifies aim or hit detection. */
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.CrosshairProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT = '0;P;c;5;o;1;0t;1;0l;4;0o;2;0a;1;0f;0;1b;0';
  const PALETTE = ['#ffffff','#00ff00','#c8ff00','#dfff00','#ffff00','#00ffff','#ff00ff','#ff0000'];
  const num = (v, fallback, min, max) => {
    const x = Number(v);
    return v == null || v === '' || !Number.isFinite(x) ? fallback : Math.min(max, Math.max(min, x));
  };
  const flag = (v, def) => v == null ? def : !(v === '0' || v === 'false');
  function parse(code) {
    if (typeof code !== 'string' || code.length > 4096 || !/^\s*0\s*;/.test(code))
      throw new Error('발로란트 조준점 코드(0;P;...)를 입력하세요.');
    const parts = code.trim().split(';');
    if (parts.length < 3 || parts.length > 350) throw new Error('유효한 조준점 코드가 아닙니다.');
    const sections = {root: {}, P: {}, A: {}, S: {}};
    let section = 'root';
    for (let i = 1; i < parts.length; ++i) {
      const key = parts[i].trim();
      if (!key) continue;
      if (key === 'P' || key === 'A' || key === 'S') { section = key; continue; }
      // Riot's profile values are semicolon-separated key/value pairs, including
      // optional toggles added by recent patches. Keep unknown keys harmless.
      if (i+1 < parts.length && parts[i+1] !== 'P' && parts[i+1] !== 'A' && parts[i+1] !== 'S')
        sections[section][key] = parts[++i].trim();
    }
    if (!Object.keys(sections.P).length) throw new Error('코드에 기본 조준점(P) 설정이 없습니다.');
    const make = (v, inherit) => {
      const cfg = Object.assign({}, inherit || {}, v);
      const paletteNumber = Math.round(num(cfg.c, 0, 0, 8));
      let color = PALETTE[paletteNumber] || '#ffffff';
      if (paletteNumber === 8 && /^[a-f0-9]{6}([a-f0-9]{2})?$/i.test((cfg.u || '').replace(/^#/,'')))
        color = '#' + cfg.u.replace(/^#/,'').slice(0,6);
      function lines(prefix) {
        const g = prefix;
        return {
          shown: flag(cfg[g+'b'], prefix === '0' || ['1t','1l','1o','1a'].some(k => k in cfg)),
          length: num(cfg[g+'l'], prefix === '0' ? 4 : 2, 0, 30),
          thickness: num(cfg[g+'t'], 1, 0, 12),
          offset: num(cfg[g+'o'], prefix === '0' ? 2 : 7, 0, 40),
          alpha: num(cfg[g+'a'], 1, 0, 1),
          moveError: flag(cfg[g+'m'], false),
          fireError: flag(cfg[g+'f'], false),
          moveMultiplier: num(cfg[g+'s'], 1, 0, 5),
          fireMultiplier: num(cfg[g+'e'], 1, 0, 5),
          independentAxis: flag(cfg[g+'g'], false),
          verticalLength: num(cfg[g+'v'], num(cfg[g+'l'], 4, 0, 30), 0, 30)
        };
      }
      return {
        color,
        outline: flag(cfg.h, true) ? num(cfg.o, 0, 0, 1) : 0,
        outlineThickness: num(cfg.t, 1, 0, 5),
        dot: flag(cfg.d, false),
        dotSize: num(cfg.z, 2, 1, 16),
        dotAlpha: num(cfg.a, 1, 0, 1),
        inner: lines('0'), outer: lines('1')
      };
    };
    return {
      code: code.trim(),
      primary: make(sections.P),
      ads: Object.keys(sections.A).length ? make(sections.A, sections.P) : null,
      usePrimaryForAds: flag(sections.root.p, true)
    };
  }
  function render(container, profile, options = {}) {
    if (!container || !profile) return;
    const settings = options.ads && profile.ads && !profile.usePrimaryForAds ? profile.ads : profile.primary;
    container.replaceChildren();
    container.style.width = '0px';
    container.style.height = '0px';
    container.style.position = 'relative';
    container.style.flexShrink = '0';
    const outline = Math.min(3, settings.outlineThickness);
    function paint(el, alpha) {
      el.style.backgroundColor = settings.color;
      el.style.opacity = String(alpha);
      if (outline && settings.outline) el.style.boxShadow = `0 0 0 ${outline}px rgba(0,0,0,${settings.outline})`;
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      return el;
    }
    if (settings.dot) {
      const dot = paint(container.ownerDocument.createElement('span'), settings.dotAlpha);
      const n = settings.dotSize;
      dot.style.left = -(n/2)+'px';dot.style.top = -(n/2)+'px';
      dot.style.width = n+'px';dot.style.height = n+'px';
      container.appendChild(dot);
    }
    for (const [prefix, l] of [['inner',settings.inner], ['outer',settings.outer]]) {
      if (!l.shown || l.alpha <= 0 || l.thickness <= 0) continue;
      for (const direction of ['left','right','top','bottom']) {
        const isHorizontal = direction === 'left' || direction === 'right';
        const length = !isHorizontal && l.independentAxis ? l.verticalLength : l.length;
        if (length <= 0) continue;
        const part = paint(container.ownerDocument.createElement('span'),l.alpha);
        part.dataset.group=prefix;part.dataset.direction=direction;
        part.dataset.baseOffset=String(l.offset);part.dataset.moveErr=String(l.moveError);
        part.dataset.fireErr=String(l.fireError);
        part.dataset.moveMult=String(l.moveMultiplier);part.dataset.fireMult=String(l.fireMultiplier);
        part.style.width = (isHorizontal ? length : l.thickness) + 'px';
        part.style.height = (isHorizontal ? l.thickness : length) + 'px';
        if (direction==='left') {part.style.right=l.offset+'px';part.style.top=(-l.thickness/2)+'px';}
        if (direction==='right') {part.style.left=l.offset+'px';part.style.top=(-l.thickness/2)+'px';}
        if (direction==='top') {part.style.bottom=l.offset+'px';part.style.left=(-l.thickness/2)+'px';}
        if (direction==='bottom') {part.style.top=l.offset+'px';part.style.left=(-l.thickness/2)+'px';}
        container.appendChild(part);
      }
    }
  }
  function errorOffset(container, movement = 0, firing = 0) {
    if (!container) return;
    for (const line of container.querySelectorAll('[data-direction]')) {
      const extra = (line.dataset.moveErr==='true' ? movement * Number(line.dataset.moveMult) : 0)
        + (line.dataset.fireErr==='true' ? firing * Number(line.dataset.fireMult) : 0);
      const offset = Math.max(0, Number(line.dataset.baseOffset) + Math.min(18, extra));
      const side = {left:'right',right:'left',top:'bottom',bottom:'top'}[line.dataset.direction];
      line.style[side]=offset+'px';
    }
  }
  return {parse, render, errorOffset, DEFAULT};
});