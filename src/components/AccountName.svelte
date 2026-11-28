<script>
  // A handle as its two parts: the username over the host.
  import { handleParts } from "../lib/accounts.js";

  let { handle } = $props();
  const parts = $derived(handleParts(handle));
</script>

<span class="who"><span>{parts.user}</span><span class="quiet">{parts.host}</span></span>
