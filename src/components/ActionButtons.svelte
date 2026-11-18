<script>
  import { ACTIONS } from "../lib/constants.js";
  import { app, isBusy, openReply, perform, sentFor, undoLast } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";

  const object = $derived(app.resolved);

  // A profile offers only Follow; a post whose author couldn't be verified offers no Follow.
  function hidden(name) {
    return object.isActor ? name !== "follow" : name === "follow" && !object.author;
  }

  function idle(name) {
    return name === "follow" && !object.isActor ? "Follow author" : ACTIONS[name].idle;
  }
</script>

{#snippet action(name, undoable)}
  {@const finished = Boolean(sentFor(name))}
  <button
    type="button"
    id={name === "reply" ? "write-reply" : undefined}
    aria-haspopup={name === "reply" ? "dialog" : undefined}
    aria-pressed={finished ? "true" : undefined}
    aria-busy={isBusy(`act:${name}`) ? "true" : undefined}
    disabled={finished}
    hidden={hidden(name)}
    onclick={() => (name === "reply" ? openReply() : perform(name))}
  >
    <BusyLabel
      key={`act:${name}`}
      idle={finished ? ACTIONS[name].done : idle(name)}
      busy={name === "reply" ? "" : "Sending…"}
      reserve={[idle(name), ACTIONS[name].done]}
    />
  </button>
  {#if undoable}
    <button
      type="button"
      aria-label="Undo {name}"
      aria-busy={isBusy(`undo:${name}`) ? "true" : undefined}
      hidden={!sentFor(name)?.undo}
      onclick={() => undoLast(name)}
    >
      <BusyLabel key={`undo:${name}`} idle="Undo" busy="Undoing…" />
    </button>
  {/if}
{/snippet}

<fieldset id="action-controls" disabled={app.busy}>
  <legend>Actions</legend>
  <div class="group">
    {@render action("like", true)}
    {@render action("repost", true)}
    {@render action("reply", false)}
    {@render action("follow", true)}
  </div>
</fieldset>
