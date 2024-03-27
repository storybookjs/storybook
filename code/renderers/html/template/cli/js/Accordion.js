import './accordion.css';

const openItem = (trigger) => {
  trigger.setAttribute('aria-expanded', 'true');

  const panel = document.getElementById(trigger.getAttribute('aria-controls'));

  if (panel) {
    const pannelContent = panel.querySelector('.accordion__panel-content');

    panel.style.height = `${pannelContent?.offsetHeight}px`;

    setTimeout(() => {
      panel.style.height = 'auto';
    }, 250);
  }
};

const closeItem = (trigger) => {
  trigger.setAttribute('aria-expanded', 'false');

  const panel = document.getElementById(trigger.getAttribute('aria-controls'));

  if (panel) {
    const pannelContent = panel.querySelector('.accordion__panel-content');
    panel.style.height = `${pannelContent?.offsetHeight}px`;
    setTimeout(() => {
      panel.style.height = '0px';
    });
  }
};

export const createAccordion = (args) => {
  const accordion = document.createElement('div');
  accordion.classList.add('accordion');

  args.items.forEach((item, i) => {
    const trigger = document.createElement('button');
    trigger.classList.add('accordion__trigger');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `accordion__panel-${i}`);
    trigger.innerHTML = item.title;

    const panel = document.createElement('div');
    panel.classList.add('accordion__panel');
    panel.setAttribute('id', `accordion__panel-${i}`);
    panel.setAttribute('aria-hidden', 'true');

    const pannelContent = document.createElement('div');
    pannelContent.classList.add('accordion__panel-content');
    pannelContent.innerHTML = item.content;
    panel.appendChild(pannelContent);
    accordion.appendChild(trigger);
    accordion.appendChild(panel);

    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true' || false;
      trigger.setAttribute('aria-expanded', !expanded);
      panel.setAttribute('aria-hidden', expanded);
      if (expanded) {
        closeItem(trigger);
      } else {
        openItem(trigger);
      }
    });
  });
  return accordion;
};
