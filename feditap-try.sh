#!/usr/bin/env bash
#
# feditap-try.sh: run the same requests as the FediTap shortcut, from a terminal.
#
# Usage:
#   feditap-try.sh <config.json> <url> [resolve|like|repost|follow|reply "text"] [--dry-run]
#   feditap-try.sh <config.json> undo <activity-id> [--dry-run]
#
# <config.json> is the JSON the plugin shows under "Connect it" (one account),
# or a fediverse.json accounts file with ACCOUNT=<handle> set in the environment.
#
# The default action is "resolve", which only reads. Every other action posts a
# real activity from your account; add --dry-run to print it without sending.
#
# Requires curl and jq.

set -euo pipefail

AS2='https://www.w3.org/ns/activitystreams'
PUBLIC="${AS2}#Public"
AP_TYPE='application/ld+json; profile="https://www.w3.org/ns/activitystreams"'

die() { echo "error: $*" >&2; exit 1; }
command -v jq >/dev/null || die "jq is required (brew install jq)"

[ $# -ge 2 ] || { sed -n '3,15p' "$0"; exit 1; }

config_file=$1; shift
[ -f "$config_file" ] || die "no such file: $config_file"

DRY_RUN=0
args=()
for a in "$@"; do
	if [ "$a" = "--dry-run" ]; then DRY_RUN=1; else args+=("$a"); fi
done
set -- "${args[@]}"

# One account straight from the plugin, or one picked from an accounts file.
if jq -e '.accounts' "$config_file" >/dev/null; then
	[ -n "${ACCOUNT:-}" ] || die "accounts file: set ACCOUNT to one of: $(jq -r '.accounts | keys | join(", ")' "$config_file")"
	account=$(jq -c --arg h "$ACCOUNT" '.accounts[$h] // empty' "$config_file")
	[ -n "$account" ] || die "no account $ACCOUNT in $config_file"
else
	account=$(jq -c '.' "$config_file")
fi

field() { jq -r --arg k "$1" '.[$k] // empty' <<<"$account"; }
kind=$(field kind); kind=${kind:-activitypub}
[ "$kind" = "activitypub" ] || die "only activitypub accounts are supported here (got: $kind)"

token=$(field token);       [ -n "$token" ]  || die "config has no token"
outbox=$(field outbox);     [ -n "$outbox" ] || die "config has no outbox"
proxy=$(field proxy);       [ -n "$proxy" ]  || die "config has no proxy"
followers=$(field followers)
echo "Account: $(field handle) → $outbox" >&2

post_activity() {
	local activity=$1
	echo "Activity:" >&2
	jq . <<<"$activity" >&2
	if [ "$DRY_RUN" = 1 ]; then
		echo "(dry run: not sent)" >&2
		return
	fi
	local headers body status location
	headers=$(mktemp); body=$(mktemp)
	curl -sS -o "$body" -D "$headers" -X POST "$outbox" \
		-H "Authorization: Bearer $token" \
		-H "Content-Type: $AP_TYPE" \
		-H "Accept: application/activity+json" \
		--data-binary "$activity"
	status=$(head -n1 "$headers" | tr -d '\r')
	location=$(grep -i '^location:' "$headers" | cut -d' ' -f2- | tr -d '\r' || true)
	echo "$status" >&2
	[ -n "$location" ] && echo "Activity ID (for undo): $location" >&2
	[ -s "$body" ] && { jq . "$body" 2>/dev/null || cat "$body"; }
	rm -f "$headers" "$body"
}

# Undo needs only the activity ID that a previous run printed.
if [ "$1" = "undo" ]; then
	[ $# -ge 2 ] || die "undo needs an activity ID"
	post_activity "$(jq -n --arg ctx "$AS2" --arg obj "$2" --arg pub "$PUBLIC" \
		'{"@context": $ctx, type: "Undo", object: $obj, cc: [$pub]}')"
	exit 0
fi

url=$1
action=${2:-resolve}

# Resolve through the proxy, as the shortcut does: form-encoded id=<url>.
resolved=$(curl -sS -X POST "$proxy" \
	-H "Authorization: Bearer $token" \
	-H "Accept: application/activity+json" \
	--data-urlencode "id=$url")

jq -e '.id and .type' >/dev/null <<<"$resolved" 2>/dev/null \
	|| { echo "$resolved" >&2; die "the proxy did not return an ActivityPub object for $url"; }

type=$(jq -r '.type | if type == "array" then .[0] else . end' <<<"$resolved")
id=$(jq -r '.id' <<<"$resolved")
author=$(jq -r '.attributedTo // empty | if type == "array" then .[0] else . end | if type == "object" then .id else . end' <<<"$resolved")

case "$type" in
	Person|Service|Group|Organization|Application) is_actor=1 ;;
	*) is_actor=0 ;;
esac

echo "Type:   $type" >&2
echo "ID:     $id" >&2
[ -n "$author" ] && echo "Author: $author" >&2

base() { jq -n --arg ctx "$AS2" '{"@context": $ctx}'; }

case "$action" in
	resolve)
		exit 0
		;;
	like)
		[ "$is_actor" = 0 ] || die "can't like an actor; try follow"
		post_activity "$(base | jq --arg o "$id" --arg a "$author" --arg pub "$PUBLIC" \
			'. + {type: "Like", object: $o, to: [$a], cc: [$pub]}')"
		;;
	repost)
		[ "$is_actor" = 0 ] || die "can't repost an actor"
		post_activity "$(base | jq --arg o "$id" --arg a "$author" --arg pub "$PUBLIC" --arg f "$followers" \
			'. + {type: "Announce", object: $o, to: [$a], cc: ([$pub, $f] | map(select(. != "")))}')"
		;;
	follow)
		target=$id
		[ "$is_actor" = 1 ] || target=$author
		[ -n "$target" ] || die "no actor to follow"
		post_activity "$(base | jq --arg o "$target" '. + {type: "Follow", object: $o, to: [$o]}')"
		;;
	reply)
		[ "$is_actor" = 0 ] || die "can't reply to an actor; mention them instead"
		text=${3:-}
		[ -n "$text" ] || die "reply needs text: reply \"Your reply\""
		html="<p>$(printf '%s' "$text" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g')</p>"
		post_activity "$(base | jq --arg o "$id" --arg a "$author" --arg pub "$PUBLIC" --arg c "$html" \
			'. + {type: "Create", to: [$a], cc: [$pub],
			      object: {type: "Note", inReplyTo: $o, content: $c, to: [$a], cc: [$pub]}}')"
		;;
	*)
		die "unknown action: $action (resolve, like, repost, follow, reply, undo)"
		;;
esac
