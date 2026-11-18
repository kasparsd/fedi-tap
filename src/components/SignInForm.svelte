<script>
  import { standalone } from "../lib/support.js";
  import { app, isBusy, locked, onAccountInput, submitSignIn } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";
  import Messages from "./Messages.svelte";
</script>

<form
  id="sign-in"
  onsubmit={(event) => {
    event.preventDefault();
    void submitSignIn();
  }}
>
  <fieldset id="sign-in-controls">
    <legend>Connect account</legend>
    <label for="account-input" id="account-label">
      {app.profileLinkMode ? "Profile link" : "Account"}
    </label>
    <div class="row">
      <input
        id="account-input"
        name="account"
        type={app.profileLinkMode ? "url" : "text"}
        placeholder={app.profileLinkMode ? "https://" : "@you@example.com"}
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        required
        readonly={locked("auth")}
        aria-invalid={app.accountInvalid ? "true" : undefined}
        aria-describedby={app.accountInvalid ? "error-text" : undefined}
        value={app.accountValue}
        oninput={(event) => onAccountInput(event.currentTarget.value)}
      >
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
