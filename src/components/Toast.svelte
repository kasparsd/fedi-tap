<script>
  // The one place the page tells the person what just happened: a pill over the bottom of the screen.
  // The sections' own status lines stay in the page, out of sight, because they are what a screen
  // reader announces; this shows the same words, so it is hidden from assistive technology. It stays
  // while a task runs and for a few seconds after, and gives way to the slow-server notice (#slow).
  import { app } from "../state.svelte.js";

  const SHOW_MS = 4000;
  const text = $derived(
    app.slow
      ? ""
      : [app.messages.actions, app.messages.lookup, app.messages.reauth, app.messages.auth]
          .map((message) => message.status)
          .find(Boolean) ?? "",
  );
  let visible = $state(false);

  $effect(() => {
    visible = Boolean(text);
    if (!text || app.busy) return;
    const timer = setTimeout(() => {
      visible = false;
    }, SHOW_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if visible && text}
  <div class="pill" aria-hidden="true">{text}</div>
{/if}
