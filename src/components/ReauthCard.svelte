<script>
  import { app, isBusy, openAccountsSheet, reauthenticate } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";
  import Messages from "./Messages.svelte";
</script>

<section id="reauth">
  <fieldset id="reauth-controls" disabled={app.busy}>
    <legend>Connection expired</legend>
    <p role="alert">
      <strong>Connection expired.</strong> <span id="reauth-text">Reconnect as @{app.current.handle}.</span>
    </p>
    <button
      type="button"
      id="reauth-sign-in"
      class="primary"
      aria-busy={isBusy("reauth-sign-in") ? "true" : undefined}
      onclick={reauthenticate}
    >
      <BusyLabel key="reauth-sign-in" idle="Reconnect" busy="Looking up…" />
    </button>
    <button type="button" id="reauth-other" onclick={() => openAccountsSheet()}>Connect account</button>
  </fieldset>
  <Messages section="reauth" />
</section>
