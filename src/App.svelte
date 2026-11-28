<script>
  import { httpsUrl } from "./lib/url.js";
  import { app, start } from "./state.svelte.js";
  import AboutFooter from "./components/AboutFooter.svelte";
  import AccountsSheet from "./components/AccountsSheet.svelte";
  import ActionsPlaceholder from "./components/ActionsPlaceholder.svelte";
  import ActionButtons from "./components/ActionButtons.svelte";
  import Header from "./components/Header.svelte";
  import LookupForm from "./components/LookupForm.svelte";
  import Messages from "./components/Messages.svelte";
  import Notices from "./components/Notices.svelte";
  import ReauthCard from "./components/ReauthCard.svelte";
  import ReplySheet from "./components/ReplySheet.svelte";
  import ServerLinks from "./components/ServerLinks.svelte";
  import ShareIcon from "./components/ShareIcon.svelte";
  import ShortcutCard from "./components/ShortcutCard.svelte";
  import SignInForm from "./components/SignInForm.svelte";
  import TargetCard from "./components/TargetCard.svelte";
  import Unsupported from "./components/Unsupported.svelte";

  // Reads the accounts and the address before the first paint, then finishes any sign-in in flight.
  void start();

  const usable = $derived(app.view === "ready" || app.view === "loaded");
  const openingHost = $derived(httpsUrl(app.targetValue.trim())?.hostname ?? "");
  let aboutFooter = $state();

  // The tab title names the screen, so history and assistive technology can tell them apart.
  $effect(() => {
    document.title = `${app.title} – ⁂tap`;
  });
</script>

<main data-view={app.view}>
  <Header />
  <!-- Signed in or out, the form's own label is the visible title. -->
  <h1 id="title" class={usable || app.view === "signed-out" ? "sr" : undefined}>{app.title}</h1>
  {#if !app.accountsOpen && !app.replyOpen}<Notices />{/if}

  {#if app.view === "signed-out"}
    <p>
      Like, repost, reply and follow Fediverse content on the web using the default
      <span class="symbol"><ShareIcon /> Share</span> card of your device.
    </p>
    {#if app.targetValue}
      <section id="pending-card">
        <h2>Shared link</h2>
        <p id="pending-link" class="quiet">{app.targetValue}</p>
      </section>
    {/if}
    <SignInForm />
    <p class="quiet">
      Your account details are saved only in this browser. Works with any ActivityPub API server
      (including the ActivityPub plugin for WordPress), Mastodon, and other compatible servers.
      <a href="#how-it-works" onclick={() => aboutFooter?.showDetails()}>Learn more</a>
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
      inert={app.opening || app.stale}
      aria-busy={app.opening ? "true" : undefined}
      data-loading={(app.opening && app.showProgress) || app.stale ? "" : undefined}
    >
      <div class="card">
        <TargetCard object={app.resolved} />
      </div>
      <!-- Names who the API buttons act as; the server links act as whoever is signed in there. -->
      {#if app.accounts.length > 1}<p class="quiet">Acting as @{app.current.handle}</p>{/if}
      {#if !app.resolved.isActor}<ActionButtons />{/if}
      <ServerLinks />
    </section>
  {:else if usable && app.opening && app.showProgress}
    <div class="card"><TargetCard host={openingHost} /></div>
    <ActionsPlaceholder />
  {/if}

  <Messages section="actions" />

  {#if app.view !== "unsupported"}<ShortcutCard />{/if}
</main>

<AboutFooter bind:this={aboutFooter} />
<AccountsSheet />
<ReplySheet />
