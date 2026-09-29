// CSS modules are injected by Vite at build time; in unit tests every class name resolves to itself.
export default new Proxy({}, { get: (_t, prop) => String(prop) });
