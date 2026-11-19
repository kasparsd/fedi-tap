<script>
  // One failure the person can act on, drawn as the standard error card (the .problem section around it, in
  // Messages): a heading, what happened, its buttons and an optional disclosure for the rest.
  let { problem, slotId } = $props();
</script>

<p id="{slotId}-text" role="alert" tabindex="-1"><strong>{problem.title}</strong> {problem.message}</p>
{#each problem.actions ?? [] as action (action.label)}
  <button type="button" onclick={() => action.run()}>{action.label}</button>
{/each}
{#if problem.steps || problem.link || problem.detail}
  <details>
    <summary>{problem.steps || problem.link ? "What to do" : "Details"}</summary>
    {#if problem.steps}<p class="quiet">{problem.steps}</p>{/if}
    {#if problem.link}
      <p class="quiet">
        <a href={problem.link.href} target="_blank" rel="noopener noreferrer">{problem.link.text}</a>
      </p>
    {/if}
    {#if problem.detail}<p class="quiet">Technical detail: {problem.detail}</p>{/if}
  </details>
{/if}
