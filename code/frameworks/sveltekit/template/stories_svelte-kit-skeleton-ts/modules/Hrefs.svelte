<script>
  import { page } from '$app/state';
</script>

<ul>
  <li><a href="/basic-href">Link to <code>/basic-href</code></a></li>
  <li>
    <a href="/deep/nested/link?with=true&multiple-params=200#and-an-id"
      >Link to <code>/deep/nested/link?with=true&multiple-params=200#and-an-id</code></a
    >
  </li>
  <li><a href="https://svelte.dev">Link to <code>https://svelte.dev</code></a></li>
  <li><a href="/new-window" target="_blank">Opens in a new window</a></li>
</ul>

<p>Current URL: <span data-testid="current-url">{page.url.href}</span></p>
