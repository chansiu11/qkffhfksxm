/* Small, game-only 3D melee hit volumes shared by server and browser.
 * Distances are expressed in our fictional game world's units.
 */
(function (root, make) {
  const rules = make();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  if (root) root.MeleeRules = rules;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MODES = Object.freeze({
    light: Object.freeze({damage: 50, cooldown: .42, range: 2.9, halfAngle: .60, pitchMargin: .77}),
    heavy: Object.freeze({damage: 75, cooldown: .80, range: 2.55, halfAngle: .48, pitchMargin: .66})
  });
  const modeFor = name => name === 'heavy' ? 'heavy' : 'light';
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // Only a single target near the view's center can be contacted by a swing.
  // World-space pose and relative screen angle are deliberately decoupled from
  // bullet ray hits; knife swings must never get rifle-like reach or headshots.
  function selectTarget(source, yaw, pitch, kind, targets, isVisible) {
    const mode = modeFor(kind), spec = MODES[mode];
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const ox = Number(source.x), oy = Number(source.y), oz = Number(source.z);
    if (![ox, oy, oz, yaw, pitch].every(Number.isFinite)) return null;
    let closest = null, bestScore = Infinity;
    for (const target of targets || []) {
      if (!target || target.alive === false) continue;
      const dx = target.x - ox, dz = target.z - oz;
      const flat = Math.hypot(dx, dz);
      if (!Number.isFinite(flat) || flat < .25 || flat > spec.range + .30) continue;
      const forward = (dx * fx + dz * fz) / flat;
      if (forward < Math.cos(spec.halfAngle)) continue;
      const bodyY = target.footY + 1.23;
      const elevation = Math.atan2(bodyY - oy, flat);
      const verticalError = Math.abs(elevation - pitch);
      if (verticalError > spec.pitchMargin) continue;
      if (typeof isVisible === 'function' && !isVisible(target, {dx, dz, flat, bodyY})) continue;
      const angleError = Math.acos(clamp(forward, -1, 1));
      const score = angleError + verticalError * .38 + flat * .012;
      if (score >= bestScore) continue;
      // Source lies behind the target if it is opposite the target's forward.
      const facingX = -Math.sin(target.yaw || 0), facingZ = -Math.cos(target.yaw || 0);
      const attackerOnTargetForward = ((-dx) * facingX + (-dz) * facingZ) / flat;
      const behind = attackerOnTargetForward < -.52;
      bestScore = score;
      closest = {target, mode, behind, damage: spec.damage * (behind ? 2 : 1), distance: flat};
    }
    return closest;
  }
  return Object.freeze({MODES, modeFor, selectTarget});
});