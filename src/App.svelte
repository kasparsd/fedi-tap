<script>
  import { standalone, ios } from "./lib/support.js";
  import { app, start } from "./state.svelte.js";
  import AccountsSheet from "./components/AccountsSheet.svelte";
  import ActionButtons from "./components/ActionButtons.svelte";
  import Header from "./components/Header.svelte";
  import LookupForm from "./components/LookupForm.svelte";
  import Messages from "./components/Messages.svelte";
  import ReauthCard from "./components/ReauthCard.svelte";
  import RemoveSheet from "./components/RemoveSheet.svelte";
  import ReplySheet from "./components/ReplySheet.svelte";
  import ShortcutCard from "./components/ShortcutCard.svelte";
  import SignInForm from "./components/SignInForm.svelte";
  import TargetCard from "./components/TargetCard.svelte";
  import Unsupported from "./components/Unsupported.svelte";

  // Reads the accounts and the address before the first paint, then finishes any sign-in in flight.
  void start();

  const usable = $derived(app.view === "ready" || app.view === "loaded");
  const showHomeScreenHint = $derived(app.view === "ready" && !standalone && ios && !app.reauth);
</script>

<main>
  <Header />
  <h1 id="title">{app.title}</h1>

  {#if app.view === "signed-out"}
    <section>
      <h2>Act on Fediverse posts from your own account</h2>
      <ol>
        <li>Sign in with your Fediverse account.</li>
        <li>Open a post or profile link, or share one from your phone.</li>
        <li>Like, repost, reply or follow.</li>
      </ol>
    </section>
    {#if app.targetValue}
      <section id="pending-card">
        <h2>Shared link</h2>
        <p id="pending-link" class="quiet">{app.targetValue}</p>
      </section>
    {/if}
    <SignInForm />
    <p class="quiet">
      Works with WordPress (ActivityPub plugin) and servers that have the ActivityPub API.
    </p>
  {:else if app.view === "unsupported"}
    <Unsupported />
  {/if}

  {#if app.reauth && app.view !== "unsupported"}<ReauthCard />{/if}
  {#if usable}<LookupForm />{/if}
  {#if app.view === "loaded"}
    <TargetCard object={app.resolved} />
    <ActionButtons />
  {/if}

  <Messages section="actions">
    <p id="action-announce" role="status">{app.announce}</p>
  </Messages>

  {#if app.view !== "unsupported"}<ShortcutCard />{/if}

  {#if app.view === "signed-out"}
    <details>
      <summary>Supported servers</summary>
      <p class="quiet">
        The server needs the ActivityPub client API. On WordPress, install the ActivityPub plugin
        and turn on the API.
        <a href="https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/">Setup instructions</a>
      </p>
      <p class="quiet">Mastodon, Pixelfed, Lemmy and Misskey do not support it.</p>
    </details>
  {/if}

  {#if showHomeScreenHint}
    <details id="a2hs">
      <summary>Add to Home Screen</summary>
      <p class="quiet">Safari: Share, then Add to Home Screen.</p>
    </details>
  {/if}
</main>

<AccountsSheet />
<RemoveSheet />
<ReplySheet />
