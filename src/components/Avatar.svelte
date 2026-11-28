<script>
  import { refreshDetails } from "../state.svelte.js";

  // An account's circle: its photo, or its initials on its colour while there is no photo to show.
  // Decorative: whatever holds it is named by the account's handle.
  let { account = null, letters = "", more = 0, waiting = account?.needsReauth } = $props();

  // The photo address that has loaded or failed, so a changed address starts over.
  let loaded = $state.raw("");
  let failed = $state.raw("");
  const photo = $derived(account?.avatar && account.avatar !== failed ? account.avatar : "");

  // The photo may have moved, so ask the account's server where it is now.
  function missing() {
    failed = photo;
    void refreshDetails(account.actor);
  }
</script>

<span class={["avatar", account ? `c${account.colour ?? 0}` : "more"]} class:reconnect={waiting} aria-hidden="true">
  {account ? letters : `+${more}`}
  {#if photo}
    <img
      src={photo}
      alt=""
      hidden={loaded !== photo}
      onload={() => (loaded = photo)}
      onerror={missing}
    >
  {/if}
</span>
