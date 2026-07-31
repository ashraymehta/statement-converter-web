/**
 * Unwraps a namespace import down to its actual default export.
 *
 * Several of our dependencies (multi-number-parse, stitch-swiftmessageparser)
 * are Babel/TS-compiled CJS modules (`exports.default = ...`, `__esModule: true`).
 * Depending on the bundler's CJS/ESM interop, a plain `import x from '...'`
 * default import can end up bound to the wrapped module object instead of the
 * actual default value — walk any `.default` nesting defensively rather than
 * relying on interop matching one particular shape.
 */
export function unwrapDefault<T>(mod: unknown): T {
    let value = mod;
    while (value && typeof value !== 'function' && typeof value === 'object' && 'default' in value) {
        value = (value as { default: unknown }).default;
    }
    return value as T;
}
