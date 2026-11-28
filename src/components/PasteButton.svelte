<script>
  // The small button inside the end of a field that fills it from the clipboard.
  let { id, locked, onclick } = $props();
</script>

<button type="button" {id} class="paste" aria-disabled={locked ? "true" : undefined} {onclick}>
  Paste
</button>
