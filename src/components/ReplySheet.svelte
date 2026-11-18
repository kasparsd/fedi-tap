<script>
  import { app, isBusy, sendReply, settleFocus } from "../state.svelte.js";
  import BusyLabel from "./BusyLabel.svelte";
  import Messages from "./Messages.svelte";
  import Sheet from "./Sheet.svelte";

  // Mastodon-compatible servers keep a reply as visible as the post it answers.
  const REACH = {
    unlisted: "Replies are public, but kept out of public timelines.",
    private: "Replies go to followers only.",
    direct: "Replies go only to the people mentioned.",
  };
  const reach = $derived(REACH[app.resolved?.visibility] ?? "Replies are public.");

  const context = $derived(
    !app.current
      ? ""
      : app.resolved?.name
        ? `To ${app.resolved.name}, as @${app.current.handle}.`
        : `As @${app.current.handle}.`,
  );
</script>

<Sheet
  bind:open={app.replyOpen}
  docked
  id="reply-sheet"
  aria-labelledby="reply-title"
  onclose={settleFocus}
>
  <h2 id="reply-title">Reply</h2>
  <p id="reply-context" class="quiet">{context}</p>
  <fieldset id="reply-controls" disabled={app.busy}>
    <legend>Write a reply</legend>
    <label for="reply-text">Your reply</label>
    <textarea id="reply-text" rows="5" aria-describedby="reply-note" bind:value={app.replyText}></textarea>
    <p id="reply-note" class="quiet">{reach}</p>
    <Messages section="reply" />
    <div class="row">
      <button type="button" id="reply-cancel" onclick={() => (app.replyOpen = false)}>Cancel</button>
      <button
        type="button"
        id="reply-send"
        class="primary"
        disabled={!app.replyText.trim()}
        aria-busy={isBusy("reply-send") ? "true" : undefined}
        onclick={sendReply}
      >
        <BusyLabel key="reply-send" idle="Send" busy="Sending…" />
      </button>
    </div>
  </fieldset>
</Sheet>
