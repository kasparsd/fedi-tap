<script>
  import { standalone } from "../lib/support.js";
</script>

<section id="shortcut-card">
  <h2>Add Shortcut for iOS</h2>
  {#if standalone}<p class="quiet">The Shortcut opens Safari, not this app.</p>{/if}
  <p class="quiet">
    <a href="https://github.com/kasparsd/fedi-tap/blob/main/FediTap.cherri">Source code</a>
  </p>
  <a class="button" href="FediTap.shortcut" download>Add Shortcut</a>
</section>
