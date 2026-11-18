import { readFile } from "node:fs/promises";

const AS2 = "https://www.w3.org/ns/activitystreams";
const PUBLIC = `${AS2}#Public`;
const ACTIVITY_TYPE = `application/ld+json; profile="${AS2}"`;
const ACTOR_TYPES = new Set(["Person", "Service", "Group", "Organization", "Application"]);
const ACTIONS = new Set(["resolve", "like", "repost", "follow", "reply"]);
const USAGE = `Usage:
  npm run try -- <settings.json> <url> [resolve|like|repost|follow|reply "text"] [--dry-run]
  npm run try -- <settings.json> undo <activity-id> [--dry-run]

Set ACCOUNT=<handle> when using a multi-account settings file.
Resolve only reads. --dry-run prints activities without sending them.`;

async function readAccount(file) {
  const source = await readFile(file, "utf8");
  let config;
  try {
    config = JSON.parse(source);
  } catch {
    throw new Error(`Invalid JSON in ${file}`);
  }

  let account = config;
  if (config?.accounts) {
    const { accounts } = config;
    const handle = process.env.ACCOUNT;
    if (!handle) {
      throw new Error(`Accounts file: set ACCOUNT to one of: ${Object.keys(accounts).join(", ")}`);
    }
    if (!Object.hasOwn(accounts, handle)) throw new Error(`No account ${handle} in ${file}`);
    account = accounts[handle];
  }

  const kind = account?.kind || "activitypub";
  if (kind !== "activitypub") throw new Error(`Unsupported account kind: ${kind}`);
  for (const field of ["token", "outbox", "proxy"]) {
    if (typeof account?.[field] !== "string" || !account[field]) {
      throw new Error(`Config has no ${field}`);
    }
  }
  return account;
}

function post(url, token, body, contentType) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/activity+json"
  };
  if (contentType) headers["Content-Type"] = contentType;
  return fetch(url, { method: "POST", redirect: "manual", headers, body });
}

async function resolve(account, url) {
  const response = await post(account.proxy, account.token, new URLSearchParams({ id: url }));
  const object = await response.json().catch(() => null);
  const type = Array.isArray(object?.type) ? object.type[0] : object?.type;
  if (!response.ok || !object?.id || !type) {
    throw new Error(`The proxy did not return an ActivityPub object for ${url} (HTTP ${response.status})`);
  }

  const attributedTo = Array.isArray(object.attributedTo) ? object.attributedTo[0] : object.attributedTo;
  const author = typeof attributedTo === "string" ? attributedTo : attributedTo?.id;
  console.error(`Type:   ${type}\nID:     ${object.id}`);
  if (author) console.error(`Author: ${author}`);
  return { id: object.id, author, isActor: ACTOR_TYPES.has(type) };
}

function makeActivity(action, { id, author, isActor }, followers, reply) {
  const context = { "@context": AS2 };
  if (action === "follow") {
    const target = isActor ? id : author;
    if (!target) throw new Error("No actor to follow");
    return { ...context, type: "Follow", object: target, to: [target] };
  }

  if (isActor) throw new Error(`Can't ${action} an actor; try follow`);
  if (!author) throw new Error("The object has no author");
  const addressing = { to: [author], cc: [PUBLIC] };
  if (action === "like") {
    return { ...context, type: "Like", object: id, ...addressing };
  }
  if (action === "repost") {
    return { ...context, type: "Announce", object: id, to: [author], cc: [PUBLIC, followers].filter(Boolean) };
  }

  if (!reply) throw new Error('Reply needs text: reply "Your reply"');
  const escaped = reply.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return {
    ...context,
    type: "Create",
    ...addressing,
    object: { type: "Note", inReplyTo: id, content: `<p>${escaped}</p>`, ...addressing }
  };
}

async function sendActivity(account, activity, dryRun) {
  console.error("Activity:");
  console.error(JSON.stringify(activity, null, 2));
  if (dryRun) {
    console.error("(dry run: not sent)");
    return;
  }

  const response = await post(account.outbox, account.token, JSON.stringify(activity), ACTIVITY_TYPE);
  console.error(`HTTP ${response.status}`);
  const location = response.headers.get("location");
  if (location) console.error(`Activity ID (for undo): ${location}`);
  const body = await response.text();
  if (body) {
    let displayed = body;
    try {
      displayed = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // The server may return plain text.
    }
    console.log(displayed);
  }
  if (!response.ok) throw new Error(`The outbox rejected the activity (HTTP ${response.status})`);
}

async function main(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log(USAGE);
    return;
  }

  const [file, ...rest] = args;
  const dryRun = rest.includes("--dry-run");
  const [target, action = "resolve", reply] = rest.filter((arg) => arg !== "--dry-run");
  if (!file || !target) throw new Error(USAGE);
  if (target === "undo" && action === "resolve") throw new Error("Undo needs an activity ID");
  if (target !== "undo" && !ACTIONS.has(action)) throw new Error(`Unknown action: ${action}`);

  const account = await readAccount(file);
  console.error(`Account: ${account.handle || ""} → ${account.outbox}`);
  if (target === "undo") {
    await sendActivity(account, { "@context": AS2, type: "Undo", object: action, cc: [PUBLIC] }, dryRun);
    return;
  }

  const object = await resolve(account, target);
  if (action !== "resolve") await sendActivity(account, makeActivity(action, object, account.followers, reply), dryRun);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
