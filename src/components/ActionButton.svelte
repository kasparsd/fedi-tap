<script>
  // One action: Like, Repost and Follow toggle (pressing one that is on undoes it); Reply opens its sheet.
  import { ACTIONS } from "../lib/constants.js";
  import { actionLabel, app, doneLabel, openReply, perform, sentFor, undoLast } from "../state.svelte.js";
  import ActionIcon from "./ActionIcon.svelte";
  import BusyLabel from "./BusyLabel.svelte";

  let { name } = $props();

  const object = $derived(app.resolved);
  const sent = $derived(sentFor(name));
  const toggle = $derived(name !== "reply");
  const key = $derived(app.busyKey === `undo:${name}` ? `undo:${name}` : `act:${name}`);
  const working = $derived(app.busyKey === key);
  // A server that gave no way to undo leaves the button on and not pressable.
  const locked = $derived(toggle && Boolean(sent) && !sent.undo);
  // A profile offers only Follow; a post whose author couldn't be verified offers no Follow.
  const hidden = $derived(
    object.isActor ? name !== "follow" : name === "follow" && !object.author,
  );

  function press() {
    if (app.busy || locked) return;
    if (name === "reply") openReply();
    else if (sent) undoLast(name);
    else perform(name);
  }
</script>

<button
  type="button"
  id={name === "reply" ? "write-reply" : undefined}
  aria-haspopup={name === "reply" ? "dialog" : undefined}
  aria-pressed={toggle ? Boolean(sent) : undefined}
  aria-busy={working ? "true" : undefined}
  aria-disabled={app.busy || locked ? "true" : undefined}
  {hidden}
  onclick={press}
>
  <ActionIcon {name} />
  <BusyLabel
    {key}
    idle={sent ? doneLabel(name) : actionLabel(name)}
    busy={ACTIONS[name].doing}
    reserve={[actionLabel(name), doneLabel(name), "Undoing…"]}
  />
</button>
