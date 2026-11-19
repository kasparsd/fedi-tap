<script>
  // The groups of actions, held in place (inert, greyed) while the first link loads, so the page does not
  // jump when the post arrives. Which buttons there are is already known: Like, Repost and Reply act
  // through the API, and the account's server advertised its own set when the person signed in.
  import { advertisedActions } from "../lib/discovery.js";
  import { actionLabel, app } from "../state.svelte.js";
  import ActionIcon from "./ActionIcon.svelte";

  const server = $derived(advertisedActions(app.current));
  const host = $derived(app.current ? new URL(app.current.actor).hostname : "");
  const label = (name) => (name === "open" ? "Open" : actionLabel(name));
</script>

<div id="post-loading" class="placeholder" inert aria-hidden="true">
  {#if server.length}<h3 class="group-label">Using API</h3>{/if}
  <div class="actions">
    {#each ["like", "repost", "reply"] as name (name)}
      <button type="button" aria-disabled="true" tabindex="-1"><ActionIcon {name} />{label(name)}</button>
    {/each}
  </div>
  {#if server.length}
    <h3 class="group-label">Using {host} links</h3>
    <div class="actions">
      {#each server as name (name)}
        <button type="button" aria-disabled="true" tabindex="-1"><ActionIcon {name} />{label(name)}</button>
      {/each}
    </div>
  {/if}
</div>
