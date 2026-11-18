<script>
  // The post or profile being acted on.
  let { object } = $props();
</script>

<article id="target-card" class="post">
  {#if object.name}<h2 id="target-name">{object.name}</h2>{/if}
  <p id="target-meta" class="quiet">{[object.handle, object.date].filter(Boolean).join(" · ")}</p>
  {#if object.excerpt}<p id="target-excerpt">{object.excerpt}</p>{/if}
  <footer class="row quiet">
    <a id="target-link" href={object.id} target="_blank" rel="noopener noreferrer">
      View on {new URL(object.id).hostname}
    </a>
  </footer>
</article>
