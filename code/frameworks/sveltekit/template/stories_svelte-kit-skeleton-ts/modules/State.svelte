<script>
	import { page, navigating, updated } from '$app/state';

	updated.check();
</script>

<p>Directly importing</p>
<pre>{JSON.stringify($page, null, 2)}</pre>
<pre>{JSON.stringify($navigating, null, 2)}</pre>
<pre>{JSON.stringify($updated, null, 2)}</pre>
