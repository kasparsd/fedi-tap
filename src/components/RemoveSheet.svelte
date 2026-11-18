<script>
  import { app, confirmRemove } from "../state.svelte.js";
  import Sheet from "./Sheet.svelte";

  const account = $derived(app.accounts.find((item) => item.actor === app.removing));
</script>

<Sheet
  bind:open={app.removeOpen}
  id="remove-sheet"
  aria-labelledby="remove-title"
  aria-describedby="remove-text"
>
  <h2 id="remove-title">{account ? `Remove @${account.handle}?` : "Remove account?"}</h2>
  <p id="remove-text" class="quiet">
    Signs out here only. Revoke FediTap under connected apps on your server.
  </p>
  <div class="row">
    <button type="button" id="remove-cancel" onclick={() => (app.removeOpen = false)}>Cancel</button>
    <button type="button" id="remove-confirm" class="destructive" onclick={confirmRemove}>
      Remove
    </button>
  </div>
</Sheet>
