<script>
  import { app, resetData } from "../state.svelte.js";
</script>

<section id="unsupported">
  <p role="alert">
    <strong id="unsupported-title">{app.unsupported.title}</strong>
    <span id="unsupported-text">{app.unsupported.message}</span>
  </p>
  {#if app.unsupported.reset}
    <button type="button" id="reset-data" class="primary" onclick={resetData}>Reset</button>
  {/if}
  <h2>Try this</h2>
  <ul>
    <li>Allow website data for this page.</li>
    <li>Use a current browser.</li>
    <li>Use the published https address.</li>
    <li>Clear this site’s data in your browser settings.</li>
  </ul>
</section>
