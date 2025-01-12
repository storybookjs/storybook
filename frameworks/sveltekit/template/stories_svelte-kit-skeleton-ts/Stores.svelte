<script>
	import { page, navigating, updated, getStores } from '$app/stores';

	let { navigating: navigatingStore, page: pageStore, updated: updatedStore } = getStores();

	updated.check();
</script>

<p>Directly importing</p>
<pre>{JSON.stringify($page, null, 2)}</pre>
<pre>{JSON.stringify($navigating, null, 2)}</pre>
<pre>{JSON.stringify($updated, null, 2)}</pre>

<p>With getStores</p>
<pre>{JSON.stringify($pageStore, null, 2)}</pre>
<pre>{JSON.stringify($navigatingStore, null, 2)}</pre>
<pre>{JSON.stringify($updatedStore, null, 2)}</pre>
