<script>
  // Like, Repost and Reply act on the post. Follow acts on its author, so it sits in the byline
  // (TargetCard). A profile has only Follow, so this row is left out for it.
  import { serverActions } from "../lib/discovery.js";
  import { app } from "../state.svelte.js";
  import ActionButton from "./ActionButton.svelte";

  // Two groups when the person's server also offers the actions: name each, so it is clear which acts how.
  const grouped = $derived(serverActions(app.current, app.resolved).length > 0);
</script>

{#if grouped}<h3 id="api-label">Using API</h3>{/if}
<fieldset id="action-controls">
  <legend>Actions</legend>
  <div class="actions">
    <ActionButton name="like" />
    <ActionButton name="repost" />
    <ActionButton name="reply" />
  </div>
</fieldset>
