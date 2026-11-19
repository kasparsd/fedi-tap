<script>
  // The same actions on the person's own server (Like, Repost, Reply, Follow, Open), as links that
  // open it in a new tab. The in-app buttons above act as the signed-in account through the API.
  import { serverActions } from "../lib/discovery.js";
  import { app } from "../state.svelte.js";
  import ActionIcon from "./ActionIcon.svelte";

  const LABELS = { like: "Like", repost: "Repost", reply: "Reply", follow: "Follow", open: "Open" };
  const host = $derived(app.current ? new URL(app.current.actor).hostname : "");
  const links = $derived(serverActions(app.current, app.resolved));
</script>

{#if links.length}
  <h3 id="server-label" class="group-label">Using {host} links</h3>
  <div class="actions" id="server-links" role="group" aria-labelledby="server-label">
    {#each links as { intent, href } (intent)}
      <a id="server-{intent}" class="button" {href} target="_blank" rel="noopener noreferrer">
        <ActionIcon name={intent} />
        {LABELS[intent]}
      </a>
    {/each}
  </div>
{/if}
