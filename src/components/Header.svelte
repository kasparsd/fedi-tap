<script>
  // The product name and the account switcher (hidden until an account exists).
  import { app, chooseAccount } from "../state.svelte.js";
</script>

<header class="row">
  <a href="./" aria-label="FediTap"><abbr title="fedi">⁂</abbr>tap</a>
  <select
    id="account-select"
    aria-label="Account"
    hidden={!app.current}
    disabled={app.busy}
    value={app.current?.actor ?? ""}
    onchange={(event) => chooseAccount(event.currentTarget)}
  >
    {#each app.accounts as account (account.actor)}
      <option value={account.actor}>
        @{account.handle}{account.needsReauth ? " (reconnect)" : ""}
      </option>
    {/each}
    <option value="add">Connect account</option>
  </select>
  <!-- One progress cue for every task, laid over the header's rule so it takes no space. -->
  {#if app.showProgress}<progress aria-label={app.task?.announce}></progress>{/if}
</header>
