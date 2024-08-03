import { global } from '@storybook/global';

const { document } = global;

// https://html.spec.whatwg.org/multipage/scripting.html
const runScriptTypes = [
  'application/javascript',
  'application/ecmascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
  // Support modern javascript
  'module',
];

const SCRIPT = 'script';
const SCRIPTS_ROOT_ID = 'scripts-root';

// trigger DOMContentLoaded
export function simulateDOMContentLoaded() {
  const DOMContentLoadedEvent = document.createEvent('Event');
  DOMContentLoadedEvent.initEvent('DOMContentLoaded', true, true);
  document.dispatchEvent(DOMContentLoadedEvent);
}

function insertScript($script: any, callback: any, $scriptRoot: any) {
  const scriptEl = document.createElement('script');
  scriptEl.type = $script.type === 'module' ? 'module' : 'text/javascript';
  if ($script.src) {
    scriptEl.onload = callback;
    scriptEl.onerror = callback;
    scriptEl.src = $script.src;
  } else {
    scriptEl.textContent = $script.innerText;
  }

  // re-insert the script tag so it executes.
  if ($scriptRoot) $scriptRoot.appendChild(scriptEl);
  else document.head.appendChild(scriptEl);

  // clean-up
  $script.parentNode.removeChild($script);

  // run the callback immediately for inline scripts
  if (!$script.src) callback();
}

// runs an array of async functions in sequential order

function insertScriptsSequentially(scriptsToExecute: any[], callback: any, index = 0) {
  scriptsToExecute[index](() => {
    index++;
    if (index === scriptsToExecute.length) {
      callback();
    } else {
      insertScriptsSequentially(scriptsToExecute, callback, index);
    }
  });
}

export function simulatePageLoad($container: any) {
  let $scriptsRoot = document.getElementById(SCRIPTS_ROOT_ID);
  if (!$scriptsRoot) {
    $scriptsRoot = document.createElement('div');
    $scriptsRoot.id = SCRIPTS_ROOT_ID;
    document.body.appendChild($scriptsRoot);
  } else {
    $scriptsRoot.innerHTML = '';
  }
  const $scripts = Array.from($container.querySelectorAll(SCRIPT));

  if ($scripts.length) {
    const scriptsToExecute: any[] = [];
    $scripts.forEach(($script: any) => {
      const typeAttr = $script.getAttribute('type');

      // only run script tags without the type attribute
      // or with a javascript mime attribute value from the list
      if (!typeAttr || runScriptTypes.includes(typeAttr)) {
        scriptsToExecute.push((callback: any) => insertScript($script, callback, $scriptsRoot));
      }
    });

    // insert the script tags sequentially
    // to preserve execution order
    if (scriptsToExecute.length) {
      insertScriptsSequentially(scriptsToExecute, simulateDOMContentLoaded, undefined);
    }
  } else {
    simulateDOMContentLoaded();
  }
}
