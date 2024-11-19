// TODO: discuss about this, ideally there should be "THE FLAG" where we know things are running in SB Manager.
// This should not execute in Vitest browser mode, in Test runner, when opening a story in isolation, etc.
const shouldUseDemoMode = (globalThis.parent as any)?.STORYBOOK_ENV;

export async function wait(ms: number) {
  if (shouldUseDemoMode) {
    return new Promise((resolve) => {
      // animate mouse pointer from previous to current element
      return setTimeout(resolve, ms);
    });
  }
}

export async function projectCursorAt(
  target: Element,
  { cursorStyle = 'hand', delay = 1000 }: { cursorStyle?: 'hand' | 'circle'; delay?: number }
) {
  if (target && shouldUseDemoMode) {
    return new Promise((resolve) => {
      // animate mouse pointer from previous to current element
      let cursorEl = document.getElementById('sb-demo-cursor');
      if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.id = 'sb-demo-cursor';
        cursorEl.dataset.type = cursorStyle;
        // Use a hand image if the cursor style is 'hand', else use a circle
        if (cursorStyle === 'hand') {
          cursorEl.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#clip0_16_94)">
            <path d="M273.5 366L95.5 348L108.5 495.5L301 765L618.5 754L727.5 608L710 348L376.5 220L357 51.5L273.5 38.5V366Z"
              fill="white" stroke="black" />
            <path
              d="M757.266 410.016V401.814C757.266 352.939 717.502 313.179 668.63 313.179C657.592 313.179 647.027 315.223 637.269 318.926C628.977 278.599 593.2 248.179 550.45 248.179C538.841 248.179 527.759 250.444 517.592 254.522C506.865 217.303 471.241 189.089 430.3 189.089C419.277 189.089 408.649 191.22 398.785 195.061V88.6355C398.785 39.7599 359.021 0 310.149 0C261.278 0 221.514 39.7599 221.514 88.6355V349.653C206.001 329.842 187.348 312.576 165.697 303.677C141.537 293.75 116.112 294.935 92.1612 307.112C48.1113 329.511 29.9509 383.492 51.6764 427.451L161.781 650.273C164.893 656.387 239.509 800 374.597 800H532.171C656.418 800 757.498 698.388 757.498 573.464L757.376 410.016H757.266ZM532.175 740.91H374.601C277.291 740.91 216.668 627.701 214.482 623.533L104.653 401.274C97.0735 385.938 103.353 367.715 118.949 359.785C127.544 355.412 135.025 354.967 143.207 358.32C175.829 371.694 207.852 436.146 220.364 473.605L229.857 502.201L280.608 484.241V88.6355C280.608 72.3423 293.86 59.0903 310.153 59.0903C326.446 59.0903 339.698 72.3423 339.698 88.6355V429.39H340.234H398.789H399.324V279.694C399.324 263.2 414.089 248.179 430.303 248.179C447.093 248.179 461.818 261.987 461.818 277.724V336.815V439.238H520.909V336.815C520.909 320.522 534.161 307.27 550.454 307.27C566.747 307.27 579.999 320.522 579.999 336.815V401.814V466.813H639.089V401.814C639.089 385.521 652.341 372.269 668.634 372.269C684.928 372.269 698.179 385.521 698.179 401.814V444.072H698.317L698.416 573.487C698.412 665.806 623.836 740.91 532.175 740.91Z"
              fill="black" />
          </g>
          <defs>
            <clipPath id="clip0_16_94">
              <rect width="800" height="800" fill="white" />
            </clipPath>
          </defs>
        </svg>`;
        }
        cursorEl.addEventListener(
          'transitionend',
          () => {
            if (cursorEl) {
              cursorEl.className = 'sb-cursor-hide';
            }
            target.dispatchEvent(
              new MouseEvent('mouseover', { view: window, bubbles: true, cancelable: true })
            );
          },
          { capture: true }
        );

        document.body.appendChild(cursorEl);
      }

      if (!target.getBoundingClientRect) {
        console.log('target does not have getBoundingClientRect', target);
        return;
      }

      // Function to determine if the element is fully visible in the viewport
      const isElementInViewport = (el: Element) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
      };

      // Scroll the element into view if it's not fully visible
      if (!isElementInViewport(target)) {
        target.scrollIntoView({ block: 'center', inline: 'center' });
      }

      const moveCursor = () => {
        const { left, top, width, height } = target.getBoundingClientRect();
        // let sTop = Math.round(top + Math.min(height / 2, 50));
        // let sLeft = Math.round(left + Math.min(width / 2, 50));

        const sTop = top + (cursorStyle === 'circle' ? 15 : 25);
        const sLeft = left + (cursorStyle === 'circle' ? 15 : 25);
        cursorEl.className = '';

        if (cursorStyle === 'circle') {
          cursorEl.className = 'sb-cursor-moving';
        }
        cursorEl.style.top = `${sTop}px`;
        cursorEl.style.left = `${sLeft}px`;
        // bakes in a 10% time delay from movement ending to click event
        cursorEl.style.transitionDuration = `${Math.round(delay * 0.9)}ms`;

        setTimeout(resolve, delay);
      };

      // Timeout is needed when there are animations on the page e.g. sidebar sliding etc, else the calculation is off and the cursor goes to the wrong place
      setTimeout(moveCursor, 300);
    });
  }
}
