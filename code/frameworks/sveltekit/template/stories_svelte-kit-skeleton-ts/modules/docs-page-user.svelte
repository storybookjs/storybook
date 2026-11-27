<script>
  import { page } from '$app/state';
</script>

<p>{page.data.user ? `Welcome, ${page.data.user.name}` : 'Please log in'}</p>
