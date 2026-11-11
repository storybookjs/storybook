<script>
	import { page, navigating, updated } from '$app/state';

	updated.check();
</script>

<h1>$app/state</h1>

<h2>page</h2>
<pre data-testid="page">{JSON.stringify(page, null, 2)}</pre>

<h2>navigating</h2>
<pre data-testid="navigating">{JSON.stringify(navigating, null, 2)}</pre>

<h2>updated</h2>
<pre data-testid="updated">{JSON.stringify(updated, null, 2)}</pre>
