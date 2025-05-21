'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function accessRoute() {
  const user = (await cookies()).get('user');

  if (!user) {
    redirect('/');
  }

  revalidatePath('/');
  redirect(`/protected`);
}

export async function logout() {
  (await cookies()).delete('user');
  revalidatePath('/');
  redirect('/');
}

export async function login() {
  (await cookies()).set('user', 'storybookjs');
  revalidatePath('/');
  redirect('/');
}
