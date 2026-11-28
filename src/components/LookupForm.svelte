<script>
  import {
    app,
    findTarget,
    isBusy,
    locked,
    onTargetInput,
    pasteLink,
  } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";
  import Messages from "./Messages.svelte";
  import PasteButton from "./PasteButton.svelte";
</script>

<!-- novalidate: an empty or malformed entry is answered by the page's own error card, not the browser's bubble. -->
<form
  id="lookup"
  novalidate
  onsubmit={(event) => {
    event.preventDefault();
    void findTarget();
  }}
>
  <fieldset id="lookup-controls">
    <legend>Open a post or profile</legend>
    <label for="post-url">Open a post or profile</label>
    <div class="row">
      <div class="field">
        <input
          id="post-url"
          name="url"
          type="url"
          enterkeyhint="go"
          placeholder="Paste a link"
          autocomplete="off"
          spellcheck="false"
          required
          readonly={locked("lookup")}
          aria-invalid={app.targetInvalid ? "true" : "false"}
          aria-describedby={app.targetDescribedBy ?? undefined}
          value={app.targetValue}
          oninput={(event) => onTargetInput(event.currentTarget.value)}
        >
        {#if app.showProgress && isBusy("open")}<span class="pulse" aria-hidden="true"></span>{/if}
        <PasteButton id="paste-link" locked={locked("lookup")} onclick={pasteLink} />
      </div>
      <button
        type="submit"
        id="open-link"
        class={app.reauth || app.view === "loaded" ? undefined : "primary"}
        aria-busy={isBusy("open") ? "true" : undefined}
        aria-disabled={locked("lookup") ? "true" : undefined}
      >
        <BusyLabel key="open" idle="Load" busy="Loading…" />
      </button>
    </div>
    <Messages section="lookup" />
  </fieldset>
</form>
