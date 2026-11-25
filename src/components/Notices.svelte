<script>
  // What tells the person about a running task, wherever they are looking: the announcement a screen
  // reader hears, the slow-server notice with its Cancel, and the toast. While a sheet is open the page
  // behind it is inert, so these must live inside the sheet: Cancel could not be pressed and nothing would
  // be announced from there. Only one copy is ever in the page (App shows it when no sheet is open).
  import { app, cancelTask } from "../state.svelte.js";
  import Toast from "./Toast.svelte";
</script>

<!-- Told once the progress delay has passed, so a quick request announces nothing. -->
<p id="task-announce" role="status">{app.showProgress ? (app.task?.announce ?? "") : ""}</p>
{#if app.slow}
  <section id="slow" class="pill">
    <p role="status">Still waiting for your server…</p>
    {#if app.task?.cancellable}<button type="button" onclick={cancelTask}>Cancel</button>{/if}
  </section>
{/if}
<Toast />
