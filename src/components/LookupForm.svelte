<script>
  import {
    app,
    buttonLabel,
    findTarget,
    isBusy,
    locked,
    onTargetInput,
    pasteLink,
  } from "../state.svelte.js";
  import Messages from "./Messages.svelte";
</script>

<form
  id="lookup"
  onsubmit={(event) => {
    event.preventDefault();
    void findTarget();
  }}
>
  <fieldset id="lookup-controls">
    <legend>Open a link</legend>
    <label for="post-url">Link</label>
    <div class="row">
      <div class="field">
        <input
          id="post-url"
          type="url"
          placeholder="Post or profile link"
          autocomplete="off"
          spellcheck="false"
          required
          readonly={locked("lookup")}
          aria-invalid={app.targetInvalid ? "true" : undefined}
          aria-describedby={app.targetDescribedBy ?? undefined}
          value={app.targetValue}
          oninput={(event) => onTargetInput(event.currentTarget.value)}
        >
        <button
          type="button"
          id="paste-link"
          aria-disabled={locked("lookup") ? "true" : undefined}
          onclick={pasteLink}
        >
          Paste
        </button>
      </div>
      <button
        type="submit"
        id="open-link"
        class={app.reauth ? undefined : "primary"}
        aria-busy={isBusy("open") ? "true" : undefined}
        aria-disabled={locked("lookup") ? "true" : undefined}
      >
        {buttonLabel("open", "Open")}
      </button>
    </div>
    <Messages section="lookup" />
  </fieldset>
</form>
