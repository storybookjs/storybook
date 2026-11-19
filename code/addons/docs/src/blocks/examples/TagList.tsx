import React from 'react';

export interface TagListProps {
  label: string;
  tags: Set<string> | string[];
  onSelect?: (tag: string) => void;
}

export const TagList = ({ label, tags }: TagListProps) => (
  <div>
    <strong>{label}</strong>
    <ul>
      {Array.from(tags).map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  </div>
);
