<script>
  import { standalone } from "../lib/support.js";
</script>

<section id="shortcut-card">
  <h2>Share to FediTap</h2>
  <p class="quiet">
    Add the Shortcut (<a href="https://github.com/kasparsd/fedi-tap/blob/main/FediTap.cherri"
      >view source</a
    >), then choose FediTap in the share sheet of any app to open a shared link here.
    Works on iPhone, iPad and Mac.
  </p>
  {#if standalone}<p class="quiet">The Shortcut opens Safari, not this app.</p>{/if}
  <a class="button" href="FediTap.shortcut" download>Add Shortcut</a>
</section>
