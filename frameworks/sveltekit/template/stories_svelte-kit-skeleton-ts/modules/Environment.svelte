<script>
  import { browser, dev, building, version } from '$app/environment';
</script>

<div data-testid="browser">{browser}</div>
<div data-testid="dev">{dev}</div>
<div data-testid="building">{building}</div>
<div data-testid="version" data-chromatic="ignore">{version}</div>
