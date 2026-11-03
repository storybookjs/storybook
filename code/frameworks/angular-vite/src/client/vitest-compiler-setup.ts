// Keep this wrapper; don't register the bare `@angular/compiler` specifier as a setup file instead.
// Vitest re-imports setup files under a fresh `?browserv=` URL before every test file, so a bare
// specifier re-evaluated the whole compiler per test file, and with `browser.isolate: false` the
// page kept every copy. Importing it from here keeps the compiler's own URL stable, so it is
// evaluated once per page.
import '@angular/compiler';
