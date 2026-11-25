<script>
  // A native <dialog> driven by `open`. Escape, Cancel, the back gesture and a tap on the backdrop do
  // nothing while a task runs. The content exists only while open, so ids never repeat with the page
  // behind it. Notices (the slow notice and its Cancel) sit inside, because the page behind is inert.
  import { app } from "../state.svelte.js";
  import Notices from "./Notices.svelte";

  let { open = $bindable(false), docked = false, children, onclose, ...attributes } = $props();
  let dialog = $state();

  // Light dismiss is native where `closedby` exists (idle: any, so a tap outside closes; busy: none,
  // which also stops a repeated back gesture, which a cancel handler alone can't). Elsewhere a click
  // handler does it, and it needs the press and the release outside, so dragging a text selection out
  // of the box doesn't close the sheet.
  const nativeLightDismiss = typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;
  let pressedOutside = false;

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

  function outside(event) {
    const box = dialog.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  }

  function pointerdown(event) {
    pressedOutside = !nativeLightDismiss && event.target === dialog && outside(event);
  }

  function click(event) {
    const started = pressedOutside;
    pressedOutside = false;
    if (nativeLightDismiss || !started || event.target !== dialog || app.busy) return;
    if (outside(event)) dialog.close();
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
  closedby={app.busy ? "none" : "any"}
  oncancel={cancel}
  onkeydown={keydown}
  onpointerdown={pointerdown}
  onclick={click}
  onclose={closed}
  {...attributes}
>
  {#if open}{@render children()}<Notices />{/if}
</dialog>
