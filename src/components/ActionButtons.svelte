<script>
  // Like, Repost and Reply act on the post. Follow acts on its author, so it sits in the byline
  // (TargetCard). A profile has only Follow, so this row is left out for it.
  import ActionButton from "./ActionButton.svelte";
</script>

<fieldset id="action-controls">
  <legend>Actions</legend>
  <div class="actions">
    <ActionButton name="like" />
    <ActionButton name="repost" />
    <ActionButton name="reply" />
  </div>
</fieldset>
