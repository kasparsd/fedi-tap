<script>
  import { httpsUrl } from "./lib/url.js";
  import { app, cancelTask, start } from "./state.svelte.js";
  import AboutFooter from "./components/AboutFooter.svelte";
  import AccountsSheet from "./components/AccountsSheet.svelte";
  import ActionsPlaceholder from "./components/ActionsPlaceholder.svelte";
  import ActionButtons from "./components/ActionButtons.svelte";
  import Header from "./components/Header.svelte";
  import LookupForm from "./components/LookupForm.svelte";
  import Messages from "./components/Messages.svelte";
  import ReauthCard from "./components/ReauthCard.svelte";
  import ReplySheet from "./components/ReplySheet.svelte";
  import ServerLinks from "./components/ServerLinks.svelte";
  import Toast from "./components/Toast.svelte";
  import ShortcutCard from "./components/ShortcutCard.svelte";
  import SignInForm from "./components/SignInForm.svelte";
  import TargetCard from "./components/TargetCard.svelte";
  import Unsupported from "./components/Unsupported.svelte";

  // Reads the accounts and the address before the first paint, then finishes any sign-in in flight.
  void start();

  const usable = $derived(app.view === "ready" || app.view === "loaded");
  const openingHost = $derived(httpsUrl(app.targetValue.trim())?.hostname ?? "");
  let aboutFooter = $state();
</script>

<main data-view={app.view}>
  <Header />
  <!-- Signed in or out, the form's own label is the visible title. -->
  <h1 id="title" class={usable || app.view === "signed-out" ? "sr" : undefined}>{app.title}</h1>
  <p id="task-announce" role="status">{app.task?.announce ?? ""}</p>
  {#if app.slow}
    <section id="slow" class="pill">
      <p role="status">Still waiting for your server…</p>
      {#if app.task?.cancellable}<button type="button" onclick={cancelTask}>Cancel</button>{/if}
    </section>
  {/if}

  {#if app.view === "signed-out"}
    <section>
      <p>Act on Fediverse posts from your own account:</p>
      <ol>
        <li>Connect your Fediverse account.</li>
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
      Works with Mastodon, WordPress with the ActivityPub plugin, and other compatible servers.
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
      {#if !app.resolved.isActor}<ActionButtons />{/if}
      <!-- Names who the API buttons act as; the server links act as whoever is signed in there. -->
      {#if app.accounts.length > 1}<p class="quiet">Acting as @{app.current.handle}</p>{/if}
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
<Toast />
<AccountsSheet />
<ReplySheet />
