<script>
  import { serverActions } from "./lib/discovery.js";
  import { httpsUrl } from "./lib/url.js";
  import { app, cancelTask, start } from "./state.svelte.js";
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
  const grouped = $derived(serverActions(app.current, app.resolved).length > 0);
  const openingHost = $derived(httpsUrl(app.targetValue.trim())?.hostname ?? "");
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
    <p class="quiet">Works with Mastodon, WordPress and other ActivityPub servers.</p>
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
      <ServerLinks />
      {#if app.accounts.length > 1 && !grouped}<p class="quiet">Acting as @{app.current.handle}</p>{/if}
    </section>
  {:else if usable && app.opening && app.showProgress}
    <div class="card"><TargetCard host={openingHost} /></div>
    <ActionsPlaceholder />
  {/if}

  <Messages section="actions" />

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

</main>

<Toast />
<AccountsSheet />
<ReplySheet />
