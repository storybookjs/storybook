<script>
  import { asset, resolve } from '$app/paths';
</script>

<div data-testid="asset">{asset('robots.txt')}</div>
<div data-testid="resolve">{resolve('/')}</div>
