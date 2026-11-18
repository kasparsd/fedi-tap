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
        @{account.handle}{account.needsReauth ? " (sign in again)" : ""}
      </option>
    {/each}
    <option value="add">Add account</option>
  </select>
</header>
