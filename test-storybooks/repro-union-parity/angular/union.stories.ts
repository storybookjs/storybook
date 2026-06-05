@Component({ template: '' })
export class UnionComponent {
  @Input() status: 'active' | 'inactive' | 'pending' | null = 'active';
}
