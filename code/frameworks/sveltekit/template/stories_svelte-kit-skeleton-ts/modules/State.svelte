<script>
	import { page, navigating, updated } from '$app/state';

	// Test reactive access to page properties
	const pageUrl = $derived(page.url);
	const pageParams = $derived(page.params);
	const pageData = $derived(page.data);
	const pageStatus = $derived(page.status);
	const pageError = $derived(page.error);
	const pageForm = $derived(page.form);
	const pageState = $derived(page.state);

	// Test navigating state
	const isNavigating = $derived(navigating);

	// Test updated state
	const isUpdated = $derived(updated.current);

	// Trigger check for demonstration
	updated.check();
</script>

<h2>$app/state Module Test</h2>

<h3>Page State</h3>
<pre>URL: {JSON.stringify(pageUrl, null, 2)}</pre>
<pre>Params: {JSON.stringify(pageParams, null, 2)}</pre>
<pre>Data: {JSON.stringify(pageData, null, 2)}</pre>
<pre>Status: {pageStatus}</pre>
<pre>Error: {JSON.stringify(pageError, null, 2)}</pre>
<pre>Form: {JSON.stringify(pageForm, null, 2)}</pre>
<pre>State: {JSON.stringify(pageState, null, 2)}</pre>

<h3>Navigating State</h3>
<pre>{JSON.stringify(isNavigating, null, 2)}</pre>

<h3>Updated State</h3>
<pre>Current: {isUpdated}</pre>