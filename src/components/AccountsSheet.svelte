<script>
  import { initials } from "../lib/accounts.js";
  import {
    accountsClosed,
    app,
    askRemove,
    cancelRemove,
    closeAccountsSheet,
    confirmRemove,
    switchAccount,
  } from "../state.svelte.js";
  import AccountName from "./AccountName.svelte";
  import Avatar from "./Avatar.svelte";
  import Messages from "./Messages.svelte";
  import Sheet from "./Sheet.svelte";
  import SignInForm from "./SignInForm.svelte";

  const letters = $derived(initials(app.accounts.map((account) => account.handle)));
  const off = $derived(app.busy ? "true" : undefined);
</script>

<Sheet
  bind:open={app.accountsOpen}
  docked
  id="accounts-sheet"
  aria-labelledby="sheet-title"
  onclose={accountsClosed}
>
  <div class="row title">
    <h2 id="sheet-title">Accounts</h2>
    <button type="button" id="sheet-close" aria-label="Close" aria-disabled={off} onclick={closeAccountsSheet}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
  <ul id="account-list" class="list">
    {#each app.accounts as account, index (account.actor)}
      <li class={app.removing === account.actor ? "confirm" : undefined}>
        {#if app.removing === account.actor}
          <!-- The question replaces the row, so no second dialog opens on top of this one. -->
          <span id="remove-text">Remove {account.handle}?</span>
          <button type="button" id="remove-cancel" aria-disabled={off} onclick={cancelRemove}>Cancel</button>
          <button
            type="button"
            id="remove-confirm"
            class="destructive"
            aria-disabled={off}
            onclick={confirmRemove}
          >
            Remove
          </button>
        {:else}
          {@const current = account.actor === app.current?.actor}
          <button
            type="button"
            class="pick"
            aria-label="{account.handle}{account.needsReauth ? ', needs reconnecting' : ''}"
            aria-current={current ? "true" : undefined}
            aria-disabled={off}
            onclick={() => switchAccount(account.actor)}
          >
            <Avatar {account} letters={letters[index]} />
            <AccountName handle={account.handle} />
            {#if current}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
            {/if}
          </button>
          <button
            type="button"
            class="destructive"
            aria-label="Remove {account.handle}"
            aria-disabled={off}
            data-remove={account.actor}
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
  <SignInForm label="Add account" />
  <Messages section="sheet" />
  <button type="button" id="sheet-done" aria-disabled={off} onclick={closeAccountsSheet}>Done</button>
</Sheet>
