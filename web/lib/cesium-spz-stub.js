/**
 * Build-time stub for @spz-loader/core (Gaussian-splat SPZ decoding via WASM).
 *
 * WHY: @spz-loader/core@0.3.1 (pulled in by @cesium/engine's GltfSpzLoader)
 * ships its inlined WASM binary with octal escapes inside a template literal,
 * which is a hard SyntaxError in every browser ("Octal escape sequences are
 * not allowed in template strings") and crashes any route that bundles Cesium.
 * This app renders billboards, polylines, and entities only — it never loads
 * .spz Gaussian splats — so the loader is replaced with a throwing stub via
 * the webpack alias in next.config.mjs. If splat support is ever needed, swap
 * the alias for a fixed @spz-loader/core release instead.
 */
export function loadSpz() {
  throw new Error(
    "SPZ Gaussian-splat loading is stubbed out in this build (unused by the app)."
  );
}

export default { loadSpz };
