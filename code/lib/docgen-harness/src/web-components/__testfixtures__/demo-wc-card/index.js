import { DemoWcCard } from './DemoWcCard.js';

if (!customElements.get('demo-wc-card')) {
  customElements.define('demo-wc-card', DemoWcCard);
}
