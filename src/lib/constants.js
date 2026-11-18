export const SCOPE = "read write";
export const SIGN_IN_KEY = "fedishare.sign-in";
export const AS_PROFILE = "https://www.w3.org/ns/activitystreams";
export const PUBLIC = `${AS_PROFILE}#Public`;
export const ACTIVITY_TYPE = `application/ld+json; profile="${AS_PROFILE}"`;
export const ACTOR_TYPES = new Set(["Person", "Service", "Group", "Organization", "Application"]);
export const ACTOR_ACCEPT = `application/activity+json, application/ld+json; profile="${AS_PROFILE}"`;
export const WP_SETTING =
  "On WordPress, turn on Settings › ActivityPub › Advanced › ActivityPub API.";
export const MAX_RESPONSE = 1000000;
export const MAX_HTML = 20000;
export const DRAFT_KEY = "feditap.draft";

// idle: button label. doing: label while sending. sent: the result, before " as @account".
// undone: the result of undoing. noun and verb name the action in errors.
export const ACTIONS = {
  like: {
    idle: "Like",
    doing: "Liking…",
    sent: "Liked",
    undone: "Like undone",
    noun: "Like",
    verb: "like",
  },
  repost: {
    idle: "Repost",
    doing: "Reposting…",
    sent: "Reposted",
    undone: "Repost undone",
    noun: "Repost",
    verb: "repost",
  },
  reply: { idle: "Reply", doing: "Sending…", sent: "Reply sent", noun: "Reply", verb: "reply" },
  follow: {
    idle: "Follow",
    doing: "Sending…",
    sent: "Follow request sent",
    undone: "Follow undone",
    noun: "Follow request",
    verb: "follow",
  },
};

export const WORDPRESS_HELP = {
  href: "https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/",
  text: "WordPress setup instructions",
};
export const CORS_HELP = {
  href: "https://github.com/kasparsd/fedi-tap/blob/main/docs/development.md#cors",
  text: "Troubleshoot CORS",
};
