<script>
  import { app, isBusy, openAccountsSheet, reauthenticate } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";
  import Messages from "./Messages.svelte";
</script>

<!-- Drawn as the standard error card; a failed reconnect shows its own card below it, not inside. -->
<section id="reauth">
  <fieldset id="reauth-controls" class="problem" disabled={app.busy}>
    <legend>Connection expired</legend>
    <p role="alert">
      <strong>Connection expired</strong> <span id="reauth-text">Reconnect as @{app.current.handle}.</span>
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
    <button type="button" id="reauth-other" onclick={() => openAccountsSheet()}>Use another account</button>
  </fieldset>
  <Messages section="reauth" />
</section>
