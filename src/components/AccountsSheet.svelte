<script>
  import { accountsClosed, app, askRemove, cancelRemove, confirmRemove } from "../state.svelte.js";
  import Messages from "./Messages.svelte";
  import Sheet from "./Sheet.svelte";
  import SignInForm from "./SignInForm.svelte";
</script>

<Sheet
  bind:open={app.accountsOpen}
  docked
  id="accounts-sheet"
  aria-labelledby="sheet-title"
  onclose={accountsClosed}
>
  <h2 id="sheet-title">Accounts</h2>
  <fieldset id="sheet-controls" disabled={app.busy}>
    <legend>Accounts</legend>
    <ul id="account-list" class="list">
      {#each app.accounts as account (account.actor)}
        <li>
          {#if app.removing === account.actor}
            <!-- The question replaces the row, so no second dialog opens on top of this one. -->
            <span id="remove-text">Remove @{account.handle}?</span>
            <button type="button" id="remove-cancel" onclick={cancelRemove}>Cancel</button>
            <button type="button" id="remove-confirm" class="destructive" onclick={confirmRemove}>
              Remove
            </button>
          {:else}
            <span>@{account.handle}</span>
            <button
              type="button"
              class="destructive"
              aria-label="Remove @{account.handle}"
              onclick={() => askRemove(account.actor)}
            >
              Remove
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    {#if app.removing}
      <p class="quiet">Signs out here only. Revoke FediTap under connected apps on your server.</p>
    {/if}
  </fieldset>
  <SignInForm label="Add account" />
  <Messages section="sheet" />
  <button type="button" id="sheet-done" disabled={app.busy} onclick={() => (app.accountsOpen = false)}>
    Done
  </button>
</Sheet>
