<script>
  // The post or profile being acted on, or, while the first link is still opening, a placeholder
  // that says what is being opened.
  import ActionButton from "./ActionButton.svelte";

  let { object = null, host = "" } = $props();
</script>

{#if object}
  <article id="target-card" class="post">
    <div class="byline">
      <div>
        {#if object.name}<strong id="target-name">{object.name}</strong>{/if}
        <p id="target-meta" class="quiet">
          {#if object.handle}<span>{object.handle}</span>{/if}
          {#if object.date}<span>{object.date}</span>{/if}
        </p>
      </div>
      <ActionButton name="follow" />
    </div>
    {#if object.excerpt}<p id="target-excerpt">{object.excerpt}</p>{/if}
    <footer class="row quiet">
      <a id="target-link" href={object.id} target="_blank" rel="noopener noreferrer">
        View on {new URL(object.id).hostname}
      </a>
    </footer>
  </article>
{:else}
  <article id="target-loading" class="post" aria-busy="true">
    <h2>Loading {host}…</h2>
    <div class="skeleton" aria-hidden="true">
      <div class="byline">
        <div><span></span><span></span><span></span></div>
        <span class="follow"></span>
      </div>
      <div><span></span><span></span><span></span></div>
    </div>
  </article>
{/if}
