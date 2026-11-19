<script>
  let details;

  export function showDetails() {
    details.open = true;
  }
</script>

<div id="about">
  <details bind:this={details}>
    <summary id="how-it-works">How it works</summary>

    <section>
      <h2>ActivityPub client API</h2>
      <p class="quiet">
        On WordPress, install ActivityPub 9.4 or later and
        <a href="https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/">enable the ActivityPub API</a>
        under Settings › ActivityPub › Advanced. This flow also works with servers that implement the
        <a href="https://swicg.github.io/activitypub-api/basicprofile">Social API Basic Profile draft</a>.
      </p>
      <p class="quiet">
        You approve access on your own server. FediTap uses OAuth with
        <a href="https://www.rfc-editor.org/rfc/rfc7636">PKCE</a> and identifies itself with a
        <a href="https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/">client metadata document</a>.
        It asks your server to look up the post or profile and sends actions to your
        <a href="https://www.w3.org/TR/activitypub/#client-to-server-interactions">ActivityPub outbox</a>.
      </p>
    </section>

    <section>
      <h2>Mastodon-compatible API</h2>
      <p class="quiet">
        Works with Mastodon, GoToSocial, Pleroma and Akkoma. Pixelfed support is limited to likes,
        replies and follows, and may vary by server.
      </p>
      <p class="quiet">
        FediTap <a href="https://docs.joinmastodon.org/methods/apps/">registers as an app</a> on
        your server and asks you to approve access through
        <a href="https://docs.joinmastodon.org/spec/oauth/">Mastodon’s OAuth flow</a>. It uses
        <a href="https://docs.joinmastodon.org/methods/search/">Mastodon search</a> to find links
        and the REST API to like, repost, reply or follow.
      </p>
    </section>

    <p class="quiet">Lemmy and Misskey are unsupported.</p>
  </details>

  <footer>
    <p class="quiet">
      Built by <a href="https://kaspars.net/">Kaspars Dambis</a> ·
      <a href="https://github.com/kasparsd/fedi-tap">Source on GitHub</a>
    </p>
  </footer>
</div>

<style>
  #about {
    padding-block-end: max(var(--space-3), env(safe-area-inset-bottom));
  }

  footer {
    margin-block-start: var(--space-2);
  }
</style>
