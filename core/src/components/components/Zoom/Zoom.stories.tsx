import type { CSSProperties } from 'react';
import React, { useEffect, useState } from 'react';

import { Zoom } from './Zoom';

export default {
  component: Zoom,
  argTypes: {
    scale: {
      control: { type: 'range', min: 0.2, max: 30, step: 0.02 },
    },
  },
  parameters: {
    chromatic: { delay: 500, diffThreshold: 0.2 },
  },
};
const EXAMPLE_ELEMENT = (
  <div
    style={{
      width: 2000,
      height: 2000,
      border: '10px solid orangered',
      background: `url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAM4klEQVR4Xu2d224ktxGGayTN6LTrOO//PMmlAfvOgIEkFwEcZ71a7ep8muBjd2k4re4eVpHsaS1CeKH1is1u1s86slhcrP/261r62oGInB6LLBbNb8+PRQ75x/+3bArcPYh8vu4dZjEMyELk7Hjz0JwBYdGEddMuHmnXWPixDv/NqrkAOVw0HKJtDoAcHTZcerAQOTgQ4Rv5+ysQHbKvWyReAGUt8vIi8vQi8vzS/H1fQD08iny6MnLIG0BOGgJM2SD68lAEIPhZuj09i9w/ijw+lx55fDze+8dXKyDokJP9cAjEP142QEzR4B645v5J5PGp/hsfnkQ+fTMCcrQQOZlYZAEAolENifqkefsGRNnNgwiruFZDZP153YjRThtW6suFyPFEgKAHzhGJM7LiAOb6vuGc0s0FyOpAZLXafMqHk1aBFv46RNPJcr9cMTiltcjtY6NnSrb7h4ZDetowh6wORVbLuoBgVq+OSk61zliIr6u7cmPf3olc3OYCctyYmqUaIqqG5VTq+7rjILoApUfum195+yByYeWQ4yORZbR6P56UEyuIv6ksKDO1Rh6AU9AruaDc3Yt8vjFyCHI9JlopQBj3JNJNJQk2xVgoZKywnOZS6hDtqBVR+IMfTgcd4uRvQ0Qhqt57Q+TkKHoA+Xor8vDWtB5W6oRN1DPHL0DM5DjqjPEDoOYMMhMkEVkQ1Cu6Apc9igBsZ4w0QIKfkOmwna4a7/t7aTmWF4DcPYkQY+uAMgLIauOo4bABiLdhncEd31v7etMQ1doUEJ57Xovgl7TjLNZ/Zz8EMcLAiw0L4SOESKo0yv0sQxF/b9yhAHi5hHgZDqc2wHh+DuGaxfrnf62bMHS7b6Ay7fRI5PCwCVPz83TZYBb+tOHsGMCxVfLDWR0v37oya/T3cEkXkOi7GkD6Wrz/sTwQOYusoz4AlXVBOuw9wHjtvgUGQQCxBbMGYfY1psfigrMGTOd+QJBUHyOZj7ka7x5aJo//gg7aArEdIGwcsVHUAsg/62ZSzI2W903dl2+/7HfyBj+FTbKb+95f9wNyzH5EpDOIa8W7h6mThkN+PEvtvekXxGar1/grYpOx4p0/5Uj9vQJI38CdMr6baP+q4Se+3dqiwiZAmPj5ajtuRRjF413jWMacVpII8Vh3jyJs+oStWdVvrb7DlyJIyl6Xghj6RPow97uu72y7jlhWPNPTtjkEqyq2rvQBL4cApFfUpRIJ1menb1fD0iNso0112qsxwy8iPQe4arwELhzRgXjt6JLUlgQIYPDRfZtEXg7pEiH1g1P7QYjUuJKGfzQclPqOGMBYjMYJFIB3cbUxXLb0YI/NNArIr/9eBz8jpNIMhDVYWR4v+8PxdsTYSoRd/QlfWHb0mCdGRo2GYo+dxC09GIlISKwLCYMmFqOLhSzW//hjt6vJSvdsJDH5WmF2vvqSfWkDdb1GRsorLIuDLJdBKysJEHb2jBkgajrX2ieHMyCCtdVaJFhaWE8pDQNkQOekcQiK2bq7ByDEr0ruMsaTxbn65thWRfzC8aWbBZBsDmEPw6oMAyAVQyZeDkH05gRKh4BkcaSmDu0NkL+c1dv/wAG8dIgsOJ1QTunGfntqBmS2yGICHl2AyPI8l0osiyLVMWsBwl47hE5pewME0eCxzlImRR+4JOzcpT4gzffUEFnvApBak4/pj7VC6CS11YgesCAQWbPWIRAIcTXFTqFldWJskN6E6NKjDZZ9fg1matyMnwBh2TkkueF2KNqb4ofA4h4Hj3AMltYUeQ0WUPq4KRwziQ7+6P/TN96UsxB+iGuzrSyvUueDait2nTREIyTB6SSLTkkVdSX74UAORntTOCQHkKlC8EowzS4ssZJLghCPpWmpPeOneersaWjCg/UjNR/L+7z1fUHEtOk1KWF5z/i5z+QDwlGEjETr2mH4MVmNCEuNMeUSOvX5bEBKZBzitU/JJTFxMIvnpFuyAEHklEi0rmH/p67I4ESSkNYevtm30s8ChFVdItEaomAcWKPGFqKn9IUY7DKGdKWUByr0UcPDpdQDIIXOhkzpl+yiI75AibMeu97T9/sss7ckIHxcreCehzBYY+gXrDFvJrvnvVmOIeGF0uFq9udzcoU9RBh7BjFW68Rt33uzAMGxq3HIhlxhT65XaTB0PPRJCItzZK3WS9pxs8LvOWmku+ZVazt113t3cQsJCDV9lyxAanGIEgVzOJSByqFihWdTE/A8r84CpCaH6GQAvZRp7SHQ0DMQDmBKi7AsHeJNI7USBuMBRe8J81vfZelfI1iZBYg3jdQyae2L2JrjaSu8fNJ8SkWQs/yQKQEBGEBRU9uyk+dZAJZnNNxRApSs0Ik3r9cy2b6+gKEprHNR+KzsK2NSRXFP3ZvXmwvIlsIvFLop8U160DNH0WdxiCeNtMTE4zHgliA6Z1LGKdckzgJk3xwSAzMnS8yTpKdzyQJkDhyyxS0ofdJBMytL5HIxpqu3hlZW+N2TaJ072ZTng9JfNucH96X0valHWRzizclKIWqJPmoi72N72HskIguQnBSgEgRPGUOVfo1zH7veb8l617GyHMP3AIhONMTdOke6dxE09/ceXZIFiFeHIELIoSVw+Jqi2aZrdokQl90go51TqvrTupOnSRk1j0HE34/nTr0Ti1+SFcvy6JCSm0+hUk6b0MxEUk7dAgqcUvMoRAyKVWxlAeIRWbUOVmolt9R4Uu1j2QoKYXosrtQ2OSC1Eqy10ItFPJAGaz0fmUrY2NGznAjO0iEeDqmVpQggX4yVd6Y4owLHWioCZQHiSbSeEyCs4tq5xXDsl/7CyL3MluWHoA8sidZ4zbVO33o4BIpMcSSiW1pjTOxlcYg10TpkJ1YsB8tKtOgQCBMWyXndEIulcIA7lqUVdCxhidqAeKOstZW7xfTVLeEeLho/sONJtK6dv+sN6NVO9DYB8jJYFmQcEK3Xa9nbhqt+PLcajun9LTWy4lFrmeL6jskA8eT11rKymLwnwlrT0FBALDrELbL0Tqj09dv0rO0hW/UIuWU18pNjuhDPIgaX0txmrzdrsXZ2OxNiRabMv3bdLgUAhzU1EOo2e72A1CylpwQgHkSm+tiqBAyCo/HFNCkr2NrH6qm7OcSbaE1pVio4TNEABkUfqoi2Pke4kJI/lEvPOD2c+v1WQ8MNiJdDahcvSyXUVP2sOm3UMfzt940kDuYtVaHZVKKUkbOiNYTY96nbqcBIFVdxIkZ8vvG1fnATUlisf9Fi/O1VFaGA/kKEmz45IuAthFzbQbQQPC7Zqs+peFMfKy6aTB99pk9RhyXcVtDm2gntExN9zOBQpR4fo2uZYfh2BN55ciTy14+2/YR48iFcQU3gDvW0uo7WdG/nt+mls4nuMwm3O7dE0OeZRJdg+m9D1ahfpUD7UWOETwGdIjLWRauA9JzUWqx/+mc7+3bJMHFFn5wnCvNzSXH3pmgmEk8+vuGg4b62Xlak3LfYM2W2M+8Trp24t9e3xzIkaTu+c7ctZT585VHQA8tNoS9vWbz3emfhzrXQXgymAdid/aMOamUBCPrkkcsEmhvb0gChp/cuXHQJossSD7NMbl999bibxzVQQIh/8SfKERgHJL5ckhdbZaUS671fJtkFHbGukQJPeElTh7hTvVNadhyQ+LaE3Kvz3stFxCkcF1/ggvNpLYIAIJ8uRS7fFs5MByT36rxwOSWXVRpryKcQaLI+XMRyv72qPUf+sJ9+vxC54jz89m2fO0RWdP1q7tV5anl93GPdrCzg1o1V1C2W7Dny97QW+c/FtpXVfpsBkAwdEhMCqyScOXkH96jH3z1UlxdxZZ0LoP73a2MydypGTKPU+1ZmUPRcQbSvwx2J7KKFaYJ/1tM8qbbc7PnpqrfgTboOIZQS32WYOJ/RbsFQcNaVL/H+XWNQFpBI7lgYxJomxTsZ989cQAhne67O2zVpfk9SNMpxLgo/3MS5uZ92dAqelCcFpOOD7HYMY7N3dSByknFBcQow4VAnltgEexjd7yGsE8r/3dsqNowBwniUEiQEFTc21j5fN5knnVjcuMiKr9DrXjaZQmBvnxBtPmzCNnphmXessec0WEnEFq7wNBI6+hpcgPJG3MH9hKE0WvEKyNtt6B2ARKeRpgSkO8Fw+KcFJxTRdBgC8UqEUPyJL6H0gKEbcfGzKP9QZLNjBMQe/c2dyMWNg0PiS+0JxXdZzzOJEs+8Fs5v92505cXxMo0+h7C9vrS9vq7ENzCGxul0vHBP+ogRoM41HAIgZh0SA8KpKKu9XWricx1HM1r4Pjz4LfAHPlq3LEgbClVRt/ul65A51rKaA1Ca95x6qotvRmR96b8/axiQ4FFT9KWdNQq+9kmkORB4im9wAaJ346pcDg6cQ5lOMcH39g7VIT3f/T+lOOGi/Z/IjAAAAABJRU5ErkJggg==')`,
    }}
  />
);

const TemplateElement = (args: any) => <Zoom.Element {...args} />;

export const ElementActualSize = TemplateElement.bind({});

// @ts-expect-error (to be converted to CSF3)
ElementActualSize.args = {
  scale: 1,
  children: EXAMPLE_ELEMENT,
};

export const ElementZoomedIn = TemplateElement.bind({});

// @ts-expect-error (to be converted to CSF3)
ElementZoomedIn.args = {
  scale: 0.7,
  children: EXAMPLE_ELEMENT,
};

export const ElementZoomedOut = TemplateElement.bind({});

// @ts-expect-error (to be converted to CSF3)
ElementZoomedOut.args = {
  scale: 3,
  children: EXAMPLE_ELEMENT,
};

const style: CSSProperties = {
  width: '500px',
  height: '500px',
  border: '2px solid hotpink',
  position: 'relative',
};

const TemplateIFrame = (args: any) => {
  const iFrameRef = React.useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [loaded, hasLoaded] = useState(false);

  useEffect(() => {
    if (loaded) {
      setScale(args.scale);
    }
  }, [args.scale, loaded]);
  return (
    <Zoom.IFrame iFrameRef={iFrameRef} scale={scale} active={args.active}>
      <iframe
        id="iframe"
        title="UI Panel"
        onLoad={() => hasLoaded(true)}
        src="/iframe.html"
        style={style}
        ref={iFrameRef}
        allow="fullscreen"
      />
    </Zoom.IFrame>
  );
};
export const IFrameActualSize = TemplateIFrame.bind({});

// @ts-expect-error (to be converted to CSF3)
IFrameActualSize.args = {
  scale: 1,
  active: true,
};

// The iFrame stories are disabled because useGlobals works in practice
// but, for some reason breaks in the stories for Zoom.iFrame
// @ts-expect-error (to be converted to CSF3)
IFrameActualSize.parameters = {
  chromatic: { disableSnapshot: true },
};

export const IFrameZoomedIn = TemplateIFrame.bind({});

// @ts-expect-error (to be converted to CSF3)
IFrameZoomedIn.args = {
  scale: 0.7,
  active: true,
};

// @ts-expect-error (to be converted to CSF3)
IFrameZoomedIn.parameters = {
  chromatic: { disableSnapshot: true },
};

export const IFrameZoomedOut = TemplateIFrame.bind({});

// @ts-expect-error (to be converted to CSF3)
IFrameZoomedOut.args = {
  scale: 3,
  active: true,
};

// @ts-expect-error (to be converted to CSF3)
IFrameZoomedOut.parameters = {
  chromatic: { disableSnapshot: true },
};
