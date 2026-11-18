<script>
  import { standalone } from "../lib/support.js";
</script>

<section id="shortcut-card">
  <h2>Add Apple Shortcut</h2>
  <p class="quiet">
    Add the Shortcut (<a href="https://github.com/kasparsd/fedi-tap/blob/main/fedi-tap.cherri"
      >view source</a
    >), then choose FediTap in the share sheet of any app to open a shared link here.
    Works on iPhone, iPad and Mac.
  </p>
  {#if standalone}<p class="quiet">The Shortcut opens Safari, not this app.</p>{/if}
  <a class="button" href="%E2%81%82tap.shortcut" download>Add Shortcut</a>
</section>
