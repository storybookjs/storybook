import Handlebars from 'handlebars';

export function handlebars(source: string, data: any) {
  const template = Handlebars.compile(source);

  return template(data);
}
