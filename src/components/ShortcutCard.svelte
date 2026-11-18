<script>
  import { standalone } from "../lib/support.js";
  import { dismissShortcut, haveShortcut } from "../state.svelte.js";
</script>

<section id="shortcut-card">
  <h2>Add Shortcut for iOS</h2>
  {#if standalone}<p class="quiet">The Shortcut opens Safari, not this app.</p>{/if}
  <p class="quiet">
    <a href="https://github.com/kasparsd/fedi-tap/blob/main/FediTap.cherri">Source code</a>
  </p>
  <a class="button" id="add-shortcut" href="FediTap.shortcut" download onclick={dismissShortcut}>
    Add Shortcut
  </a>
  <button type="button" id="shortcut-have" onclick={haveShortcut}>Dismiss</button>
</section>
