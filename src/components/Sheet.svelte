<script>
  // A native <dialog> driven by `open`. Escape, Cancel and a tap on the backdrop do nothing while a
  // task runs. The content exists only while open, so ids never repeat with the page behind it.
  import { app } from "../state.svelte.js";

  let { open = $bindable(false), docked = false, children, onclose, ...attributes } = $props();
  let dialog = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function cancel(event) {
    if (app.busy) event.preventDefault();
  }

  function keydown(event) {
    if (event.key === "Escape" && app.busy) event.preventDefault();
  }

  function click(event) {
    if (event.target !== dialog || app.busy) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    ) {
      dialog.close();
    }
  }

  function closed() {
    open = false;
    onclose?.();
  }
</script>

<!-- The backdrop is part of the dialog element; Escape already closes it from the keyboard. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class={docked ? "sheet" : undefined}
  oncancel={cancel}
  onkeydown={keydown}
  onclick={click}
  onclose={closed}
  {...attributes}
>
  {#if open}{@render children()}{/if}
</dialog>
