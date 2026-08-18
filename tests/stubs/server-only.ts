/**
 * `server-only` throws when imported outside a React Server Component, which is exactly
 * what it is for — and exactly what stops Vitest importing a server module. The tests
 * alias the package to this empty stub; the marker still does its job in the app build.
 */
export {};
