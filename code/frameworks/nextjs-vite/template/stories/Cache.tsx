import React from 'react';

import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache';

interface CacheComponentProps {
  profile?: 'default' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'max';
  tags?: string[];
}

export default function CacheComponent({
  profile = 'default',
  tags = ['my-tag'],
}: CacheComponentProps) {
  cacheLife(profile);

  for (const tag of tags) {
    cacheTag(tag);
  }

  return (
    <div>
      <h3>Cache Component</h3>
      <p>
        <strong>Cache Life Profile:</strong> {profile}
      </p>
      <p>
        <strong>Cache Tags:</strong> {tags.join(', ')}
      </p>
    </div>
  );
}
