// Vitest re-imports setup files under a fresh `?browserv=` URL before every test file. Importing the
// compiler from this wrapper keeps the compiler's own URL stable, so it is evaluated once per page
// instead of once per test file (and, with `browser.isolate: false`, retained once per test file).
import '@angular/compiler';
