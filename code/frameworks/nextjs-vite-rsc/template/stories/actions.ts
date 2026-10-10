'use server';

export async function greet(_previous: string, formData: FormData) {
  return `Hello, ${formData.get('name')}, from a Server Action`;
}
