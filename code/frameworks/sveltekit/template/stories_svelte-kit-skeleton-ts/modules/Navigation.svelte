<script>
	import { goto, invalidate, invalidateAll, afterNavigate, replaceState, pushState } from '$app/navigation';

	export let afterNavigateFn;

	afterNavigate(afterNavigateFn);
</script>

<button
	on:click={() => {
		goto('/storybook-goto');
	}}>goto</button
>

<button
	on:click={() => {
		invalidate('/storybook-invalidate');
	}}>invalidate</button
>

<button
	on:click={() => {
		invalidateAll();
	}}>invalidateAll</button
>

<button
	on:click={() => {
		pushState('/storybook-push-state', {});
	}}>pushState</button
>

<button
	on:click={() => {
		replaceState('/storybook-replace-state', {});
	}}>replaceState</button
>
