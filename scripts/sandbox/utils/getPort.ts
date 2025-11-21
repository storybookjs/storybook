import { allTemplates } from '../../../code/lib/cli-storybook/src/sandbox-templates';
import { type TemplateDetails, tasks } from '../../task';

export function getPort(template: Pick<TemplateDetails, 'key' | 'selectedTask'>) {
  const templateIndex = Object.values(allTemplates).indexOf(allTemplates[template.key]);
  const taskIndex = Object.values(tasks).indexOf(tasks[template.selectedTask]);

  return 3000 + templateIndex * 100 + taskIndex;
}
