<script>
  // Signed out, the product name. With an account, the current one first (it opens the Accounts sheet)
  // and the others as circles that switch in one tap. Controls are aria-disabled while a task runs, so
  // focus stays on them.
  import { headerSplit, initials } from "../lib/accounts.js";
  import { app, isBusy, openAccountsSheet, switchAccount } from "../state.svelte.js";
  import AccountName from "./AccountName.svelte";
  import Avatar from "./Avatar.svelte";

  const letters = $derived(initials(app.accounts.map((account) => account.handle)));
  const lettersOf = (account) => letters[app.accounts.indexOf(account)];
  const split = $derived(headerSplit(app.others));
  const find = (id) => app.accounts.find((account) => account.actor === id);
  const note = (account) => (account.needsReauth ? ", needs reconnecting" : "");
  const waiting = $derived(split.hidden.some((id) => find(id)?.needsReauth));
  const off = $derived(app.busy ? "true" : undefined);
</script>

<header class="row">
  {#if !app.current}
    <a href="./" aria-label="FediTap"><abbr title="fedi">⁂</abbr>tap</a>
  {:else}
    <div class="accounts" role="group" aria-label="Accounts">
      <button
        type="button"
        id="account-active"
        class="active"
        aria-label="{app.current.handle}{note(app.current)}, accounts"
        aria-haspopup="dialog"
        aria-disabled={off}
        onclick={() => openAccountsSheet()}
      >
        <Avatar account={app.current} letters={lettersOf(app.current)} />
        <AccountName handle={app.current.handle} />
        <span class="caret" aria-hidden="true"></span>
      </button>
      <span class="others">
        {#each split.shown as id (id)}
          {@const account = find(id)}
          <button
            type="button"
            title={account.handle}
            aria-label="Switch to {account.handle}{note(account)}"
            aria-disabled={off}
            aria-busy={isBusy(`switch:${id}`) ? "true" : undefined}
            onclick={() => switchAccount(id)}
          >
            <Avatar {account} letters={lettersOf(account)} />
          </button>
        {/each}
        {#if split.hidden.length}
          <button
            type="button"
            id="account-more"
            aria-label="+{split.hidden.length} more accounts{waiting ? ', one needs reconnecting' : ''}"
            aria-haspopup="dialog"
            aria-disabled={off}
            onclick={() => openAccountsSheet()}
          >
            <Avatar more={split.hidden.length} {waiting} />
          </button>
        {/if}
      </span>
    </div>
  {/if}
</header>
