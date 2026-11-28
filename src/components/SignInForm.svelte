<script>
  // `label` names the account field when no profile link is asked for.
  import { standalone } from "../lib/support.js";
  import {
    app,
    isBusy,
    locked,
    onAccountInput,
    pasteAccount,
    submitSignIn,
  } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";
  import Messages from "./Messages.svelte";
  import PasteButton from "./PasteButton.svelte";

  let { label = "Connect account" } = $props();
</script>

<!-- novalidate: an empty or malformed entry is answered by the page's own error card, not the browser's bubble. -->
<form
  id="sign-in"
  novalidate
  onsubmit={(event) => {
    event.preventDefault();
    void submitSignIn();
  }}
>
  <fieldset id="sign-in-controls">
    <legend>Connect account</legend>
    <label for="account-input" id="account-label">
      {app.profileLinkMode ? "Profile link" : label}
    </label>
    <div class="row">
      <div class="field">
        <input
          id="account-input"
          name="account"
          type={app.profileLinkMode ? "url" : "text"}
          placeholder={app.profileLinkMode ? "https://" : "@you@example.com"}
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          enterkeyhint="go"
          inputmode={app.profileLinkMode ? "url" : "email"}
          spellcheck="false"
          required
          readonly={locked("auth")}
          aria-invalid={app.accountInvalid ? "true" : "false"}
          aria-describedby={app.accountInvalid ? "error-text" : undefined}
          value={app.accountValue}
          oninput={(event) => onAccountInput(event.currentTarget.value)}
        >
        <PasteButton id="paste-account" locked={locked("auth")} onclick={pasteAccount} />
      </div>
      <button
        type="submit"
        id="continue"
        class="primary"
        aria-busy={isBusy("continue") ? "true" : undefined}
        aria-disabled={locked("auth") ? "true" : undefined}
      >
        <BusyLabel key="continue" idle="Connect" busy="Looking up…" reserve={["Connecting…"]} />
      </button>
    </div>
    <Messages section="auth" />
    {#if standalone}<p class="quiet">Signed in separately from Safari.</p>{/if}
  </fieldset>
</form>
