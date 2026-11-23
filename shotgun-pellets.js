/* Shared deterministic pellet fan for visual effects and game hit testing. */
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.ShotgunPellets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  function directions(yaw, pitch, pelletCount = 1, spreadBase = 0, rotation = 0) {
    const count = Math.max(1, Math.min(16, Math.floor(Number(pelletCount) || 1)));
    const cone = count > 1 ? Math.max(0, Math.min(.18, Number(spreadBase) || 0)) : 0;
    const angle = Number.isFinite(rotation) ? rotation : 0;
    const cp = Math.cos(pitch);
    const f = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
    // The camera's horizontal right and up vectors, not world-space offsets.
    const right = [-f[2] / Math.max(.05, cp), 0, f[0] / Math.max(.05, cp)];
    const up = [-right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1]];
    const result = [];
    for (let i = 0; i < count; ++i) {
      // Center pellet keeps the crosshair accurate. Other pellets have visible separation.
      const radius = i === 0 ? 0 : cone * (.44 + .50 * Math.sqrt(i / (count - 1)));
      const theta = angle + i * 2.399963229728653;
      const ox = radius * Math.cos(theta), oy = radius * Math.sin(theta);
      const x = f[0] + right[0] * ox + up[0] * oy;
      const y = f[1] + right[1] * ox + up[1] * oy;
      const z = f[2] + right[2] * ox + up[2] * oy;
      const norm = Math.hypot(x, y, z) || 1;
      result.push([x / norm, y / norm, z / norm]);
    }
    return result;
  }
  return { directions };
});