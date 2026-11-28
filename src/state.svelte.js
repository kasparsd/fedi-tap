// The app's reactive state and everything that changes it. Components read `app` and call the
// functions below; the protocol itself lives in lib/ and knows nothing about the page.

import { tick } from "svelte";
import { currentId, otherIds, selectAccount } from "./lib/accounts.js";
import { activityKey, backendFor } from "./lib/backend.js";
import { ACTIONS, DRAFT_KEY } from "./lib/constants.js";
import { repostable } from "./lib/discovery.js";
import { Problem, problemOf } from "./lib/problem.js";
import { setRequestSignal } from "./lib/signal.js";
import { authorize, completeSignIn } from "./lib/signin.js";
import { readStore, resetStore, STORE_KEY, saveStore, useStore, withAccount } from "./lib/store.js";
import { checkSupport } from "./lib/support.js";
import { httpsUrl, sharedLink } from "./lib/url.js";

// Each message section has a status line (always in the page, so it is announced) and a slot for
// one problem. The ids tie the markup to focus handling and `aria-describedby`.
export const SLOTS = {
  auth: { status: "status", error: "error" },
  lookup: { status: "lookup-status", error: "lookup-error" },
  actions: { status: "action-status", error: "action-error" },
  sheet: { status: "sheet-status", error: "sheet-error" },
  reply: { status: "reply-status", error: "reply-error" },
  reauth: { status: "reauth-status", error: "reauth-error" },
};
const EMPTY = { status: "", problem: null };
// A second switch this soon after one is a double tap on circles that have just traded places.
const SWITCH_GUARD = 400;

class AppState {
  // In the order they were connected, which is the order the Accounts sheet lists them in.
  accounts = $state.raw([]);
  current = $state.raw(null);
  // The ids of the other accounts, in the order the header shows them.
  others = $state.raw([]);
  // The loaded post or profile. Raw, so a slow task can tell it is still the same object.
  resolved = $state.raw(null);
  // The link that was opened to get `resolved`. The post is stale once the field no longer holds it.
  resolvedFor = $state.raw("");
  get stale() {
    return Boolean(this.resolved) && !this.opening && this.targetValue.trim() !== this.resolvedFor;
  }
  unsupported = $state.raw(null);

  // The link field and the sign-in field.
  targetValue = $state.raw("");
  targetInvalid = $state.raw(false);
  targetDescribedBy = $state.raw(null);
  accountValue = $state.raw("");
  accountInvalid = $state.raw(false);
  profileLinkMode = $state.raw(false);
  replyText = $state.raw("");

  // The running task, if any: controls are off and the pressed button says what it is doing.
  // `showProgress` and `slow` turn on after a delay, so a quick request shows nothing extra.
  task = $state.raw(null);
  showProgress = $state.raw(false);
  slow = $state.raw(false);

  messages = $state.raw(Object.fromEntries(Object.keys(SLOTS).map((name) => [name, EMPTY])));
  // Finished actions, by account, target and kind. Replaced as a whole on change.
  done = $state.raw({});

  accountsOpen = $state.raw(false);
  replyOpen = $state.raw(false);
  removing = $state.raw(null);

  get busy() {
    return this.task !== null;
  }

  get busySection() {
    return this.task?.section ?? null;
  }

  get busyKey() {
    return this.task?.key ?? null;
  }

  get busyLabel() {
    return this.task?.label ?? "";
  }

  // Opening a link: what is on screen waits (dimmed, not clickable) until the new link arrives.
  get opening() {
    return this.task?.key === "open";
  }

  get reauth() {
    return Boolean(this.current?.needsReauth);
  }

  get view() {
    if (this.unsupported) return "unsupported";
    if (!this.current) return "signed-out";
    return this.resolved && !this.reauth ? "loaded" : "ready";
  }

  get title() {
    switch (this.view) {
      case "unsupported":
        return this.unsupported.heading;
      case "loaded":
      case "ready":
        return "Open a post or profile";
      default:
        return "Connect account";
    }
  }
}

export const app = new AppState();

let liveSection = null;
let liveMessage = "";
let switchedAt = -SWITCH_GUARD;
// The control that opened the Accounts sheet, which gets focus back when it closes.
let sheetOpener = "";

// --- Small helpers the components use -------------------------------------------------------------

const byId = (id) => document.getElementById(id);

/** True while the pressed button with this key is the one that is working. */
export const isBusy = (key) => app.busyKey === key;

/** True while a task of this section runs, so its field keeps its value but can't be edited. */
export const locked = (section) => app.busy && app.busySection === section;

/** The button label for an action. */
export function actionLabel(name) {
  return ACTIONS[name].idle;
}

/** What the button reads once the action is sent. */
export function doneLabel(name) {
  return ACTIONS[name].done ?? ACTIONS[name].idle;
}

/** What an action already sent for the loaded target (and the current account) returned, if any. */
export function sentFor(action) {
  const { resolved, current } = app;
  return resolved && current ? app.done[activityKey(current.actor, resolved, action)] : undefined;
}

/** Why an action can't be used on the loaded post, or "" when it can. */
export function lockedReason(name) {
  const object = app.resolved;
  if (!object || object.isActor) return "";
  if (name === "repost" && !repostable(object)) {
    if (object.visibility === "private")
      return "Only the author’s followers can see this post, so it can’t be reposted.";
    if (object.visibility === "direct")
      return "Only the people it mentions can see this post, so it can’t be reposted.";
    return "This post doesn’t say who can see it, so FediTap can’t repost it.";
  }
  if (name === "reply" && !object.visibility) {
    return "This post doesn’t say who can see it, so FediTap can’t reply to it safely.";
  }
  return "";
}

/**
 * A tap on an action that can't be used says why, in the status line and the pill. The line is cleared
 * first, so a second tap shows the pill and announces the reason again.
 */
export async function explainLocked(name) {
  const reason = lockedReason(name);
  if (!reason || app.busy) return;
  clearMessages("actions");
  await tick();
  setMessage("actions", { status: reason });
}

// --- Messages --------------------------------------------------------------------------------------

function setMessage(section, patch) {
  app.messages = { ...app.messages, [section]: { ...app.messages[section], ...patch } };
}

function clearMessages(section) {
  setMessage(section, EMPTY);
}

function showProblem(section, failure, title, actions) {
  setMessage(section, { problem: problemOf(failure, title, actions) });
}

function fail(section, title, cause) {
  clearMessages(section);
  showProblem(section, new Problem(title, cause, { actions: [] }));
}

/** Updates the status line of the running task, e.g. while the token is renewed. */
function say(text = liveMessage) {
  if (liveSection) setMessage(liveSection, { status: text });
}

// --- Focus -----------------------------------------------------------------------------------------

function focusFirst(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || candidate.closest("[hidden]")) continue;
    candidate.focus({ preventScroll: true });
    if (document.activeElement === candidate) return;
  }
}

async function focusProblem(section) {
  await tick();
  byId(SLOTS[section].error)?.querySelector("[role=alert]")?.focus();
}

// After a task, focus must not fall to the page behind a sheet or onto a control that is off.
export async function settleFocus() {
  await tick();
  const active = document.activeElement;
  if (active && active !== document.body && !active.matches(":disabled")) return;
  if (app.replyOpen) focusFirst(byId("reply-text"));
  else if (!app.accountsOpen) {
    const enabled = [...document.querySelectorAll("#action-controls button:not(:disabled)")];
    focusFirst(...enabled, byId("post-url"), byId("account-active"));
  }
}

// --- Accounts and the page address -------------------------------------------------------------------

function refresh() {
  const store = readStore();
  app.accounts = Object.values(store.accounts);
  const selected = currentId(store);
  app.current = app.accounts.find((account) => account.actor === selected) ?? null;
  app.others = otherIds(store);
  return app.current;
}

function setTarget(target, local = true) {
  const url = new URL(location.href);
  url.searchParams.set("url", target.href);
  history.replaceState(local ? { local: true } : null, "", url);
  app.targetValue = target.href;
}

function dropTargetParam() {
  const url = new URL(location.href);
  if (!url.searchParams.has("url")) return;
  url.searchParams.delete("url");
  history.replaceState(null, "", url);
}

function resetPreview(keepMessages = false) {
  app.resolved = null;
  app.replyOpen = false;
  app.replyText = "";
  clearMessages("reply");
  if (!keepMessages) {
    clearMessages("actions");
    clearMessages("lookup");
  }
}

// --- Running a task ----------------------------------------------------------------------------------

const PROGRESS_DELAY = 150;
const SLOW_DELAY = 5000;

/** Stops the running task if it can be cancelled (opening a link, looking up an account). */
export function cancelTask() {
  if (app.task?.cancellable) app.task.controller.abort();
}

/**
 * Runs one task with the page's controls off. Every task shows itself the same way: the pressed
 * button (`key`) says what it is doing in `busyLabel`, a thin progress bar under the header appears
 * after a short delay, screen readers hear `announce`, and after a few seconds a notice says the
 * server is slow (with Cancel when `cancellable`). A failure becomes an alert in the section. The
 * input of a form keeps its value and focus: it turns read-only and its buttons aria-disabled while
 * the request is in flight, never disabled. `task` gets `{ signal }`, aborted when cancelled.
 */
async function runTask(
  section,
  message,
  task,
  { key, busyLabel, announce, title, actions, cancellable = false } = {},
) {
  if (app.busy) return false;
  const controller = new AbortController();
  app.task = {
    section,
    key: key ?? null,
    label: busyLabel ?? "",
    announce: announce ?? busyLabel ?? "",
    cancellable,
    controller,
  };
  setRequestSignal(cancellable ? controller.signal : null);
  const timers = [
    setTimeout(() => {
      app.showProgress = true;
    }, PROGRESS_DELAY),
    setTimeout(() => {
      app.slow = true;
    }, SLOW_DELAY),
  ];
  clearMessages(section);
  setMessage(section, { status: message });
  liveSection = section;
  liveMessage = message;
  // Cancelled by the person: no problem to show, and a request that still finished is dropped.
  const cancelled = () => {
    setMessage(section, { status: "Cancelled." });
    return false;
  };
  try {
    const result = await task({ signal: controller.signal });
    if (controller.signal.aborted) return cancelled();
    setMessage(section, { status: result ?? "" });
    return true;
  } catch (failure) {
    if (controller.signal.aborted) return cancelled();
    setMessage(section, { status: "" });
    showProblem(section, failure, title, actions);
    const previous = app.current?.actor;
    try {
      const selected = refresh();
      // A reply keeps its draft and its sheet when the session ends; the person decides what next.
      const keepDraft =
        section === "reply" &&
        app.replyOpen &&
        selected?.needsReauth &&
        previous === selected.actor;
      if (!keepDraft && (selected?.needsReauth || previous !== selected?.actor)) resetPreview(true);
      // The session-ended screen says it already; don't repeat it as this task's error.
      if (failure?.sessionEnded && !keepDraft) clearMessages(section);
    } catch {
      resetPreview(true);
    }
    return false;
  } finally {
    for (const timer of timers) clearTimeout(timer);
    setRequestSignal(null);
    app.showProgress = false;
    app.slow = false;
    app.task = null;
    liveSection = null;
  }
}

// Refreshes the token while telling the person, so a 401 never needs another tap.
function withSession(actorId, task) {
  return withAccount(actorId, backendFor, (account, renew) =>
    task(account, async () => {
      say("Reconnecting…");
      await renew();
      say();
    }),
  );
}

// --- Clipboard ---------------------------------------------------------------------------------------

/** The clipboard's text, or null when reading it is denied or unavailable: the person types instead. */
async function readClipboard() {
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return null;
  }
}

// --- Sign in -----------------------------------------------------------------------------------------

export function onAccountInput(value) {
  app.accountValue = value;
  if (!app.accountInvalid) return;
  app.accountInvalid = false;
  clearMessages("auth");
}

export async function useProfileLink() {
  app.profileLinkMode = true;
  app.accountValue = "";
  app.accountInvalid = false;
  clearMessages("auth");
  await tick();
  byId("account-input")?.focus();
}

/** Fills the account field from the clipboard. Connect leaves the page, so that stays the person's tap. */
export async function pasteAccount() {
  if (app.busy) return;
  const previous = app.accountValue;
  const copied = await readClipboard();
  if (app.busy || app.accountValue !== previous) return;
  if (!copied) {
    if (copied === "") fail("auth", "Nothing to paste.", "Copy your account address first.");
    else fail("auth", "Can’t paste.", "Type it instead.");
    app.accountInvalid = true;
    byId("account-input")?.focus();
    return;
  }
  onAccountInput(copied);
  await tick();
  byId("continue")?.focus();
}

export async function submitSignIn() {
  if (app.busy) return;
  app.accountInvalid = false;
  const started = await runTask(
    "auth",
    "",
    () =>
      authorize(app.accountValue.trim(), {
        target: app.targetValue.trim(),
        profileLinkOnly: app.profileLinkMode,
      }),
    {
      key: "continue",
      busyLabel: "Looking up…",
      cancellable: true,
      title: "Couldn’t connect",
      actions: (problem) =>
        problem.offerProfileLink ? [{ label: "Use profile link", run: useProfileLink }] : [],
    },
  );
  if (started) return;
  app.accountInvalid = true;
  byId("account-input")?.focus();
}

export function reauthenticate() {
  const account = app.current;
  if (!account) return;
  void runTask("reauth", "", () => authorize(account.actor, { target: app.targetValue.trim() }), {
    key: "reauth-sign-in",
    busyLabel: "Looking up…",
    cancellable: true,
    title: "Couldn’t reconnect",
    actions: [{ label: "Try again", run: reauthenticate }],
  });
}

// --- Accounts sheet ----------------------------------------------------------------------------------

const focusCurrentRow = () => byId("account-list")?.querySelector('[aria-current="true"]')?.focus();

/** Opens the sheet on the current account. `keepMessages` is for a failed return from sign-in. */
export async function openAccountsSheet(keepMessages = false) {
  if (app.busy && !keepMessages) return;
  if (!keepMessages) {
    clearMessages("sheet");
    clearMessages("auth");
  }
  sheetOpener = document.activeElement?.id ?? "";
  app.accountsOpen = true;
  if (keepMessages) return;
  await tick();
  focusCurrentRow();
}

export function closeAccountsSheet() {
  if (!app.busy) app.accountsOpen = false;
}

export function accountsClosed() {
  app.removing = null;
  focusFirst(byId(sheetOpener), byId("account-active"), byId("account-input"));
}

/**
 * Switches accounts, says so, and reopens the link for the new one. One that needs reconnecting shows
 * its card instead: only that card's button leaves the page.
 */
export async function switchAccount(actorId) {
  if (app.busy || performance.now() - switchedAt < SWITCH_GUARD) return;
  if (actorId === app.current?.actor) {
    app.accountsOpen = false;
    return;
  }
  clearMessages("actions");
  clearMessages("reauth");
  const switched = await runTask(
    "lookup",
    "",
    async () => {
      await useStore((store) => {
        if (!store.accounts[actorId]) throw new Error("That account was removed in another tab.");
        selectAccount(store, actorId);
        saveStore(store);
      });
      refresh();
    },
    { key: `switch:${actorId}`, title: "Couldn’t switch accounts" },
  );
  if (!switched) return;
  switchedAt = performance.now();
  sheetOpener = "account-active";
  app.accountsOpen = false;
  // The sheet has to be gone first: the page behind it is inert, so nothing there is announced.
  await tick();
  byId("account-active")?.focus({ preventScroll: true });
  setMessage("actions", { status: `Switched to ${app.current.handle}.` });
  if (app.current.needsReauth) resetPreview(true);
  else if (app.targetValue) await findTarget({ keepNotice: true });
}

export async function askRemove(actorId) {
  if (app.busy) return;
  const account = app.accounts.find((item) => item.actor === actorId);
  if (!account) {
    // Removed in another tab: show what is left instead of asking about a ghost.
    try {
      refresh();
    } catch {
      resetPreview();
    }
    return;
  }
  app.removing = account.actor;
  await tick();
  byId("remove-cancel")?.focus();
}

export async function cancelRemove() {
  if (app.busy) return;
  const actorId = app.removing;
  app.removing = null;
  await tick();
  byId("account-list")
    ?.querySelector(`[data-remove="${CSS.escape(actorId)}"]`)
    ?.focus();
}

export async function confirmRemove() {
  if (app.busy) return;
  const actorId = app.removing;
  app.removing = null;
  if (!actorId) return;
  const wasCurrent = actorId === app.current?.actor;
  const removed = await runTask(
    "sheet",
    "",
    async () => {
      await useStore((store) => {
        // The first circle takes over from a removed current account.
        const next = currentId(store) === actorId ? otherIds(store)[0] : currentId(store);
        delete store.accounts[actorId];
        store.selectedActorId = next ?? null;
        store.others = otherIds(store);
        saveStore(store);
      });
      if (wasCurrent) resetPreview();
      refresh();
    },
    { title: "Couldn’t remove the account" },
  );
  if (!removed) return;
  if (!app.current) {
    app.accountsOpen = false;
    return;
  }
  await tick();
  focusCurrentRow();
}

// --- Open a link -------------------------------------------------------------------------------------

export function onTargetInput(value) {
  app.targetValue = value;
  app.targetInvalid = false;
  app.targetDescribedBy = null;
  clearMessages("lookup");
  dropTargetParam();
}

function markTargetInvalid() {
  app.targetInvalid = true;
  app.targetDescribedBy = `${SLOTS.lookup.error}-text`;
}

/** `keepNotice` leaves the actions' status line, for the word that an account was switched. */
export async function findTarget({ keepNotice = false } = {}) {
  if (app.busy || !app.current) return;
  if (app.current.needsReauth) {
    focusFirst(byId("reauth-sign-in"));
    return;
  }
  // What is on screen stays until the new link arrives; only the answers about it are dropped.
  if (!keepNotice) clearMessages("actions");
  clearMessages("reply");
  app.replyOpen = false;
  app.replyText = "";
  app.targetInvalid = false;
  app.targetDescribedBy = null;
  const target = httpsUrl(app.targetValue.trim());
  if (!target) {
    app.resolved = null;
    fail("lookup", "That isn’t a link.", "Enter a link that starts with https://.");
    markTargetInvalid();
    byId("post-url")?.focus();
    return;
  }
  setTarget(target);
  const actorId = app.current.actor;
  const found = await runTask(
    "lookup",
    "",
    async ({ signal }) => {
      const object = await withSession(actorId, (account, renew) =>
        backendFor(account).resolve(account, target.href, renew),
      );
      if (signal.aborted || app.current?.actor !== actorId || app.targetValue !== target.href) {
        return;
      }
      app.resolved = object;
      app.resolvedFor = target.href;
    },
    {
      key: "open",
      busyLabel: "Loading…",
      announce: `Loading ${target.hostname}…`,
      cancellable: true,
      title: "Couldn’t open this link",
    },
  );
  if (found) return;
  // A link that didn't open leaves nothing on screen that belongs to the link in the field.
  app.resolved = null;
  if (app.current && !app.current.needsReauth) {
    // Only a shown problem makes the field invalid; a cancelled lookup says "Cancelled." and leaves
    // nothing for aria-describedby to point at.
    if (app.messages.lookup.problem) markTargetInvalid();
    byId("post-url")?.focus();
  }
}

// Paste sits inside the link field: it reads the clipboard, fills the field and opens the link at once.
export async function pasteLink() {
  if (app.busy || !app.current) return;
  const previous = app.targetValue;
  const copied = await readClipboard();
  if (app.busy || !app.current || app.targetValue !== previous) return;
  const target = httpsUrl(copied ?? "");
  if (!target) {
    if (copied) fail("lookup", "No link copied.", "Copy a post or profile link first.");
    else fail("lookup", "Can’t paste.", "Type the link instead.");
    app.targetDescribedBy = `${SLOTS.lookup.error}-text`;
    byId("post-url")?.focus();
    return;
  }
  app.targetValue = target.href;
  await findTarget();
}

// A whole link pasted into the field replaces what is there and opens at once, as the Paste button
// does. Anything else pastes as usual, so part of an address can still be edited.
export function onTargetPaste(event) {
  if (app.busy || !app.current) return;
  const text = event.clipboardData?.getData("text").trim() ?? "";
  const target = /\s/u.test(text) ? null : httpsUrl(text);
  if (!target) return;
  event.preventDefault();
  onTargetInput(target.href);
  void findTarget();
}

// --- Actions -----------------------------------------------------------------------------------------

// Like, repost, follow and reply all end here. The target and account are captured up front, so a
// slow response is recorded against the link and account it was sent for, even if the page moved on.
export async function perform(action, text = "") {
  if (!app.resolved || !app.current || app.busy) return;
  const actorId = app.current.actor;
  const object = app.resolved;
  const labels = ACTIONS[action];
  const inSheet = action === "reply";
  const section = inSheet ? "reply" : "actions";
  let message = "";
  const sent = await runTask(
    section,
    "",
    async () => {
      const result = await withSession(actorId, (account, renew) =>
        backendFor(account).act(account, action, object, text, renew),
      );
      app.done = { ...app.done, [activityKey(actorId, object, action)]: result };
      const same = app.current?.actor === actorId && app.resolved === object;
      if (!same) {
        message = `${labels.noun} sent for the earlier link.`;
        return inSheet ? "" : message;
      }
      message = `${labels.sent} as @${app.current.handle}.`;
      if (inSheet) return "";
      // The button now reads as done and presses back to undo; say so only when it can't.
      return result.undo ? message : `${message} This server doesn’t allow undo from here.`;
    },
    {
      key: inSheet ? "reply-send" : `act:${action}`,
      busyLabel: labels.doing,
      title: `Couldn’t ${labels.verb}.`,
      actions: (failure) =>
        failure.sessionEnded && inSheet ? [{ label: "Reconnect", run: signInFromReply }] : [],
    },
  );
  if (sent && inSheet && message) {
    app.replyText = "";
    app.replyOpen = false;
    setMessage("actions", { status: message });
  }
  if (!sent && inSheet && app.replyOpen) void focusProblem("reply");
  void settleFocus();
}

export async function undoLast(action) {
  const sent = sentFor(action);
  if (!sent?.undo || app.busy || !app.current) return;
  const actorId = app.current.actor;
  const object = app.resolved;
  const undone = await runTask(
    "actions",
    "",
    async () => {
      await withSession(actorId, (account, renew) =>
        backendFor(account).undo(account, sent, renew),
      );
      const { [activityKey(actorId, object, action)]: _removed, ...rest } = app.done;
      app.done = rest;
      return app.current?.actor === actorId && app.resolved === object
        ? `${ACTIONS[action].undone}.`
        : "";
    },
    { key: `undo:${action}`, busyLabel: "Undoing…", title: "Couldn’t undo." },
  );
  if (!undone) void focusProblem("actions");
  void settleFocus();
}

export async function openReply() {
  clearMessages("reply");
  app.replyOpen = true;
  await tick();
  byId("reply-text")?.focus();
}

export function sendReply() {
  const text = app.replyText.trim();
  if (text) void perform("reply", text);
}

// Keeps a reply draft across the redirect to the server's sign-in page.
function signInFromReply() {
  const text = app.replyText;
  if (text.trim()) {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ target: app.targetValue, text }));
    } catch {
      // Without session storage the draft stays only until the page unloads.
    }
  }
  app.replyOpen = false;
  reauthenticate();
}

function restoreDraft() {
  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // A damaged draft is dropped.
  }
  if (app.resolved && draft?.target === app.targetValue && typeof draft.text === "string") {
    app.replyText = draft.text;
    setMessage("actions", { status: "Reply draft restored." });
  }
}

export function resetData() {
  resetStore();
  location.reload();
}

// --- Start-up ----------------------------------------------------------------------------------------

function onStorage(event) {
  if (event.key !== STORE_KEY && event.key !== null) return;
  const previous = app.current?.actor;
  try {
    const selected = refresh();
    if (previous !== selected?.actor || selected?.needsReauth) resetPreview();
    // No account left (removed in another tab): an open list of accounts has nothing to show.
    if (!selected && app.accountsOpen) app.accountsOpen = false;
  } catch (error) {
    resetPreview();
    app.unsupported = checkSupport();
    if (!app.unsupported) {
      showProblem(app.current ? "actions" : "auth", error, "Couldn’t read your accounts");
    }
  }
}

async function run() {
  app.unsupported = checkSupport();
  if (app.unsupported) return;
  refresh();
  window.addEventListener("storage", onStorage);

  const callback = new URL(location.href);
  // The Shortcut sends `url`; the Android share target may send the link inside `text`.
  const shared = sharedLink(callback.searchParams);
  const pasteShortcut = callback.searchParams.get("via") === "shortcut-paste";
  const oauthParams = ["code", "state", "error", "error_description", "error_uri", "iss"];
  const params = ["code", "state", "error"].some((key) => callback.searchParams.has(key))
    ? new URLSearchParams(callback.search)
    : null;
  if (params) for (const key of oauthParams) callback.searchParams.delete(key);
  callback.searchParams.delete("via");
  for (const key of ["text", "title"]) callback.searchParams.delete(key);
  if (params || callback.href !== location.href)
    history.replaceState(history.state, "", callback.href);
  if (shared) setTarget(shared, Boolean(history.state?.local));
  if (params) {
    // With an account already connected the sign-in form lives in the accounts sheet, so a failed
    // return opens it there with the error beside the form.
    if (app.current) void openAccountsSheet(true);
    const signedIn = await runTask(
      "auth",
      "",
      async () => {
        await completeSignIn(params, ({ target, account }) => {
          if (target) setTarget(target);
          // A failed return shows what was typed again, so the marked field isn't empty.
          app.accountValue = account;
        });
        refresh();
        app.accountValue = "";
        app.profileLinkMode = false;
      },
      { key: "continue", busyLabel: "Connecting…", title: "Connection failed" },
    );
    if (!signedIn) {
      app.accountInvalid = true;
      return;
    }
    app.accountsOpen = false;
  }
  if (app.targetValue && app.current && !app.current.needsReauth) await findTarget();
  restoreDraft();
  // The Android home-screen shortcut: reading the clipboard needs a tap, so only bring Paste forward.
  if (pasteShortcut && !shared && app.current && !app.current.needsReauth) {
    await tick();
    byId("paste-link")?.focus();
  }
}

/** Reads the saved accounts and the address, finishes a sign-in that is returning, opens a shared link. */
export function start() {
  return run().catch((error) => {
    showProblem("auth", error, "Something went wrong");
  });
}
