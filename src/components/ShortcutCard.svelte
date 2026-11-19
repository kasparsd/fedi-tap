<script>
  import { standalone } from "../lib/support.js";
</script>

<!-- Both ways to share into the app are shown on every device: the page cannot tell which one is wanted. -->
<section id="shortcut-card">
  <p class="quiet">
    Enable instant access by adding as Apple Shortcut or adding as home app on Android:
  </p>
  <details id="shortcut-apple">
    <summary>Add as Apple Shortcut</summary>
    <p class="quiet">
      Add the Shortcut (<a href="https://github.com/kasparsd/fedi-tap/blob/main/fedi-tap.cherri"
        >view source</a
      >), then choose Open in Fediverse in the share sheet of any app to open a shared link here.
      Works on iPhone, iPad and Mac.
    </p>
    {#if standalone}<p class="quiet">The Shortcut opens Safari, not this app.</p>{/if}
    <a class="button" href="Open%20in%20Fediverse.shortcut" download>Add Shortcut</a>
  </details>
  <details id="shortcut-android">
    <summary>Add as Web app on Android</summary>
    <p class="quiet">
      Open the browser menu and choose Install app or Add to Home screen, then pick ⁂tap in the
      share sheet of any app to open a shared link here. Works in Chrome and Edge on any system.
    </p>
  </details>
</section>
