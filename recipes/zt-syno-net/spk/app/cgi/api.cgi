#!/bin/sh
# zt-syno-net — management API for the DSM app.
#
#   GET  api.cgi?action=status              node status and joined networks
#   POST api.cgi?action=join&id=<16 hex>    join a network
#   POST api.cgi?action=leave&id=<16 hex>   leave a network
#
# Only DSM administrators: the caller must be signed in to DSM (checked by
# DSM's own authenticate.cgi, which also needs the session's SynoToken, so a
# foreign page cannot call this) and belong to the "administrators" group.
# It talks to zerotier-one's local API on 127.0.0.1 with the daemon's token.

HOME_DIR="/var/packages/zt-syno-net/var"

reply() {
    printf 'Status: %s\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\r\n%s\n' "$1" "$2"
    exit 0
}

user=$(/usr/syno/synoman/webman/modules/authenticate.cgi 2>/dev/null)
[ -n "${user}" ] || reply "401 Unauthorized" '{"error":"not-authenticated"}'
case " $(id -Gn "${user}" 2>/dev/null) " in
    *" administrators "*) ;;
    *) reply "403 Forbidden" '{"error":"admin-only"}' ;;
esac

param() {
    printf '%s' "${QUERY_STRING}" | tr '&' '\n' | sed -n "s/^$1=//p" | head -n 1
}
action=$(param action)
network_id=$(param id | tr 'A-F' 'a-f')

token=$(cat "${HOME_DIR}/authtoken.secret" 2>/dev/null)
port=$(cat "${HOME_DIR}/zerotier-one.port" 2>/dev/null)
[ -n "${port}" ] || port=9993
if [ -z "${token}" ]; then
    reply "503 Service Unavailable" "{\"error\":\"token-unreadable\",\"cgiUser\":\"$(id -un)\"}"
fi

zt() {
    method=$1
    path=$2
    curl -s -m 8 -X "${method}" -H "X-ZT1-Auth: ${token}" -H "Content-Type: application/json" \
        ${3:+--data "$3"} "http://127.0.0.1:${port}${path}"
}

valid_id() {
    printf '%s' "${network_id}" | grep -Eq '^[0-9a-f]{16}$'
}

case "${action}" in
    status)
        st=$(zt GET /status) || st=""
        [ -n "${st}" ] || reply "503 Service Unavailable" '{"error":"service-down"}'
        nets=$(zt GET /network)
        [ -n "${nets}" ] || nets="[]"
        reply "200 OK" "{\"status\":${st},\"networks\":${nets}}"
        ;;
    join|leave)
        [ "${REQUEST_METHOD}" = "POST" ] || reply "405 Method Not Allowed" '{"error":"post-only"}'
        valid_id || reply "400 Bad Request" '{"error":"bad-network-id"}'
        if [ "${action}" = "join" ]; then
            out=$(zt POST "/network/${network_id}" '{}')
        else
            out=$(zt DELETE "/network/${network_id}")
        fi
        [ -n "${out}" ] || reply "502 Bad Gateway" '{"error":"service-error"}'
        reply "200 OK" "{\"ok\":true,\"network\":${out}}"
        ;;
    *)
        reply "400 Bad Request" '{"error":"unknown-action"}'
        ;;
esac
