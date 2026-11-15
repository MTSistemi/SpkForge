# zt-syno-net (ZeroTier) service definition.
#
# The daemon runs as the package user (sc-zt-syno-net), never as root. It needs
# CAP_NET_ADMIN and /dev/net/tun, which bin/zt-syno-net-setup grants when run
# as root from a DSM boot-up task (see the install wizard). No other package
# (no privilege broker) is involved.

ZEROTIER="${SYNOPKG_PKGDEST}/bin/zerotier-one"
# -U: skip zerotier-one's own root check; the capability is granted instead.
SERVICE_COMMAND="${ZEROTIER} -U ${SYNOPKG_PKGVAR}"
SVC_BACKGROUND=y
SVC_WRITE_PID=y

service_prestart ()
{
    # Never let zerotier-one invent a new identity when one exists but cannot be
    # read: the node would come up under a new address, unknown to the network.
    if [ -e "${SYNOPKG_PKGVAR}/identity.secret" ] && [ ! -r "${SYNOPKG_PKGVAR}/identity.secret" ]; then
        echo "ERROR: ${SYNOPKG_PKGVAR}/identity.secret exists but is not readable by $(id -un)."
        echo "Run the boot-up task once: /bin/sh ${SYNOPKG_PKGDEST}/bin/zt-syno-net-setup (as root)"
        exit 1
    fi
    if [ ! -c /dev/net/tun ] || [ ! -w /dev/net/tun ]; then
        echo "ERROR: /dev/net/tun is missing or not writable."
        echo "Run the boot-up task once: /bin/sh ${SYNOPKG_PKGDEST}/bin/zt-syno-net-setup (as root)"
        exit 1
    fi
    # /bin/getcap is root-only on DSM (mode 0700), so the package user cannot
    # check the capability itself. The setup task records the identity of the
    # binary it granted CAP_NET_ADMIN to; an install or upgrade replaces the
    # binary, the record no longer matches, and the start refuses with a clear
    # message instead of a confusing network error.
    if [ "$(stat -c '%i:%Y:%s' "${ZEROTIER}" 2>/dev/null)" != "$(cat "${SYNOPKG_PKGVAR}/.caps-granted" 2>/dev/null)" ]; then
        echo "ERROR: ${ZEROTIER} has no CAP_NET_ADMIN yet (new install or upgrade)."
        echo "Run the boot-up task once: /bin/sh ${SYNOPKG_PKGDEST}/bin/zt-syno-net-setup (as root)"
        exit 1
    fi
}

service_postinst ()
{
    # Optional network from the install wizard: zerotier-one joins every
    # network listed in networks.d when it starts.
    if [ "${SYNOPKG_PKG_STATUS}" = "INSTALL" ] && [ -n "${wizard_network_id}" ]; then
        network_id=$(echo "${wizard_network_id}" | tr 'A-F' 'a-f' | tr -d ' ')
        case "${network_id}" in
            *[!0-9a-f]*) echo "Ignoring invalid network ID: ${wizard_network_id}" ;;
            *)
                if [ ${#network_id} -eq 16 ]; then
                    mkdir -p "${SYNOPKG_PKGVAR}/networks.d"
                    : > "${SYNOPKG_PKGVAR}/networks.d/${network_id}.conf"
                fi
                ;;
        esac
    fi
}
