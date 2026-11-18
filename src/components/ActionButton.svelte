<script>
  // One action: Like, Repost and Follow toggle (pressing one that is on undoes it); Reply opens its sheet.
  import { ACTIONS } from "../lib/constants.js";
  import { actionLabel, app, openReply, perform, sentFor, undoLast } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";

  let { name } = $props();

  const object = $derived(app.resolved);
  const sent = $derived(sentFor(name));
  const toggle = $derived(name !== "reply");
  const key = $derived(app.busyKey === `undo:${name}` ? `undo:${name}` : `act:${name}`);
  const working = $derived(app.busyKey === key);
  // A server that gave no way to undo leaves the button on and not pressable.
  const locked = $derived(toggle && Boolean(sent) && !sent.undo);
  // A profile offers only Follow; a post whose author couldn't be verified offers no Follow.
  const hidden = $derived(
    object.isActor ? name !== "follow" : name === "follow" && !object.author,
  );

  function press() {
    if (app.busy || locked) return;
    if (name === "reply") openReply();
    else if (sent) undoLast(name);
    else perform(name);
  }
</script>

{#snippet icon(name)}
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {#if name === "like"}
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z" />
    {:else if name === "repost"}
      <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
    {:else if name === "reply"}
      <path
        d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"
      />
    {:else}
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
    {/if}
  </svg>
{/snippet}

<button
  type="button"
  id={name === "reply" ? "write-reply" : undefined}
  aria-haspopup={name === "reply" ? "dialog" : undefined}
  aria-pressed={toggle ? Boolean(sent) : undefined}
  aria-busy={working ? "true" : undefined}
  aria-disabled={app.busy || locked ? "true" : undefined}
  {hidden}
  onclick={press}
>
  {@render icon(name)}
  <BusyLabel
    {key}
    idle={actionLabel(name)}
    busy={ACTIONS[name].doing}
    reserve={[actionLabel(name), "Undoing…"]}
  />
</button>
