<script>
  // The device's own share symbol: a box with an arrow on Apple devices, three joined dots elsewhere.
  import { appleDevice } from "../lib/support.js";
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
  {#if appleDevice}
    <path d="M12 15V3M8 7l4-4 4 4M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
  {:else}
    <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
  {/if}
</svg>
