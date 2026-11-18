<script>
  // A button's text. It says what the button is doing while its own task runs (`busy`, or the
  // label the task gave), and the button keeps the width of its longest text, so nothing moves
  // when the text changes. `reserve` lists other texts the button may show (a done label).
  import { app, isBusy } from "../state.svelte.js";

  let { key, idle, busy = "", reserve = [] } = $props();
  const shown = $derived(isBusy(key) ? app.busyLabel || busy : idle);
  const widest = $derived([idle, busy, ...reserve].filter(Boolean));
</script>

<span class="swap">
  <span>{shown}</span>
  {#each widest as text, index (index)}
    <span class="reserve" aria-hidden="true">{text}</span>
  {/each}
</span>
