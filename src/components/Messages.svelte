<script>
  // A section's status line (always in the page so it is announced) and its one problem, if any.
  import { app, SLOTS } from "../state.svelte.js";
  import Problem from "./Problem.svelte";

  let { section, children } = $props();
  const ids = $derived(SLOTS[section]);
  const message = $derived(app.messages[section]);
</script>

<p id={ids.status} role="status">{message.status}</p>
{@render children?.()}
{#if message.problem}
  <section id={ids.error}><Problem problem={message.problem} slotId={ids.error} /></section>
{/if}
