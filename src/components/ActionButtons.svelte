<script>
  import { ACTIONS } from "../lib/constants.js";
  import {
    actionLabel,
    app,
    buttonLabel,
    openReply,
    perform,
    sentFor,
    undoLast,
  } from "../state.svelte.js";

  const object = $derived(app.resolved);

  // A profile offers only Follow; a post whose author couldn't be verified offers no Follow.
  function hidden(name) {
    return object.isActor ? name !== "follow" : name === "follow" && !object.author;
  }

  // Like, Repost and Follow toggle: pressing one that is on undoes it. Reply opens its sheet.
  function press(name) {
    if (app.busy) return;
    if (name === "reply") openReply();
    else if (sentFor(name)) undoLast(name);
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

{#snippet action(name)}
  {@const sent = sentFor(name)}
  {@const toggle = name !== "reply"}
  {@const working = app.busyKey === `act:${name}` || app.busyKey === `undo:${name}`}
  <button
    type="button"
    id={name === "reply" ? "write-reply" : undefined}
    aria-haspopup={name === "reply" ? "dialog" : undefined}
    aria-pressed={toggle ? Boolean(sent) : undefined}
    aria-busy={working ? "true" : undefined}
    aria-disabled={app.busy || (toggle && sent && !sent.undo) ? "true" : undefined}
    hidden={hidden(name)}
    onclick={() => {
      if (!(toggle && sent && !sent.undo)) press(name);
    }}
  >
    {@render icon(name)}
    {working ? app.busyLabel : actionLabel(name, object)}
  </button>
{/snippet}

<fieldset id="action-controls">
  <legend>Actions</legend>
  <div class="actions">
    {@render action("like")}
    {@render action("repost")}
    {@render action("reply")}
    {@render action("follow")}
  </div>
</fieldset>
