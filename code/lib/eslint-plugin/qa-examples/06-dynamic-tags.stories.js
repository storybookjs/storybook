// Tags built from spreads or variables cannot be read, so tag filtering breaks for the file.
import { Button } from './Button';

const baseTags = ['autodocs'];

export default {
  component: Button,
  tags: [...baseTags, 'stable'],
};

export const Primary = {};
