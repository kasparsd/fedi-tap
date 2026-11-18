<script>
  import { accountsClosed, app, askRemove } from "../state.svelte.js";
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
          <span>@{account.handle}</span>
          <button
            type="button"
            class="destructive"
            aria-label="Remove @{account.handle}"
            onclick={() => askRemove(account.actor)}
          >
            Remove
          </button>
        </li>
      {/each}
    </ul>
  </fieldset>
  <SignInForm />
  <Messages section="sheet" />
  <button type="button" id="sheet-done" disabled={app.busy} onclick={() => (app.accountsOpen = false)}>
    Done
  </button>
</Sheet>
