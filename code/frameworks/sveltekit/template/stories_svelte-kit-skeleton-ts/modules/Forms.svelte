<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	const { submit } = $props();
</script>

<form method="post" action="?/subscribe" use:enhance={submit}>
	<label>Email <input name="email" /></label>
	<button>Subscribe</button>
</form>

{#if page.form?.error}
	<p role="alert">{page.form.error}</p>
{/if}
{#if page.form?.email}
	<p>Subscribed {page.form.email}</p>
{/if}
{#if page.error}
	<p role="alert">Error: {page.error.message}</p>
{/if}
<p>Status: <span data-testid="status">{page.status}</span></p>
