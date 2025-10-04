import '@testing-library/jest-dom';

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = ((..._args: unknown[]) =>
    Promise.reject(new Error('fetch is not implemented. Mock it in your test.'))) as typeof fetch;
}
