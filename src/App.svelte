<script>
  import { standalone, ios } from "./lib/support.js";
  import { httpsUrl } from "./lib/url.js";
  import { app, cancelTask, start } from "./state.svelte.js";
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
  const openingHost = $derived(httpsUrl(app.targetValue.trim())?.hostname ?? "");
  const showHomeScreenHint = $derived(app.view === "ready" && !standalone && ios && !app.reauth);
</script>

<main>
  <Header />
  <h1 id="title">{app.title}</h1>
  <p id="task-announce" role="status">{app.task?.announce ?? ""}</p>
  {#if app.slow}
    <section id="slow">
      <p role="status">Still waiting for your server…</p>
      {#if app.task?.cancellable}<button type="button" onclick={cancelTask}>Cancel</button>{/if}
    </section>
  {/if}

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
      Works with Mastodon-compatible servers, WordPress (ActivityPub plugin) and servers that have
      the ActivityPub API.
    </p>
  {:else if app.view === "unsupported"}
    <Unsupported />
  {/if}

  {#if app.reauth && app.view !== "unsupported"}<ReauthCard />{/if}
  {#if usable}<LookupForm />{/if}
  <!-- What is on screen waits, dimmed and not clickable, while another link opens. -->
  {#if app.view === "loaded"}
    <section
      id="post"
      inert={app.opening}
      aria-busy={app.opening ? "true" : undefined}
      data-loading={app.opening && app.showProgress ? "" : undefined}
    >
      <TargetCard object={app.resolved} />
      <ActionButtons />
    </section>
  {:else if usable && app.opening && app.showProgress}
    <TargetCard host={openingHost} />
  {/if}

  <Messages section="actions">
    <p id="action-announce" role="status">{app.announce}</p>
  </Messages>

  {#if app.view !== "unsupported"}<ShortcutCard />{/if}

  {#if app.view === "signed-out"}
    <details>
      <summary>Supported servers</summary>
      <p class="quiet">
        Mastodon, GoToSocial, Pleroma and Akkoma work as they are. Pixelfed should, but is less
        tested.
      </p>
      <p class="quiet">
        WordPress needs the ActivityPub plugin with its API turned on. Other servers need the
        ActivityPub client API.
        <a href="https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/">Setup instructions</a>
      </p>
      <p class="quiet">Lemmy and Misskey are not supported.</p>
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
