<script>
  // The outline icon for an action (Like, Repost, Reply, Follow) or for opening the post elsewhere.
  let { name } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
  {#if name === "like"}
    <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z" />
  {:else if name === "repost"}
    <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
  {:else if name === "reply"}
    <path
      d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"
    />
  {:else if name === "open"}
    <path d="M14 3h7v7M21 3l-9 9M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  {:else}
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
  {/if}
</svg>
