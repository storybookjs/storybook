import { Component, Input } from '@angular/core';

import { Color, type PanelConfig, type ScalarId, type TreeNode, type User } from './types.ts';

@Component({
  selector: 'sb-named-type-props',
  template: '<span>{{ user.name }} {{ status }} {{ tree.label }} {{ id }}</span>',
})
export class NamedTypePropsComponent {
  @Input() user: User = { name: 'Ada Lovelace', age: 36 };

  @Input() status: Color = Color.Green;

  @Input() tree!: TreeNode;

  @Input() id: ScalarId = 'sb-1';

  @Input() config: PanelConfig = { collapsed: false };
}
