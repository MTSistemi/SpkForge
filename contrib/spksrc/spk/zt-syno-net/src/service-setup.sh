# zt-syno-net (ZeroTier) service definition.
#
# The daemon runs as the package user (sc-zt-syno-net), never as root, under a
# supervisor that restarts it if it stops. It needs CAP_NET_ADMIN and
# /dev/net/tun: DSM 7 refuses both to third-party packages, so the install
# wizard creates a root boot-up task ("zt-syno-net") that runs a small guard;
# the guard grants them, also after every upgrade. No other package is involved.

ZEROTIER="${SYNOPKG_PKGDEST}/bin/zerotier-one"
# The supervisor runs zerotier-one with -U (skip its own root check).
SERVICE_COMMAND="/bin/sh ${SYNOPKG_PKGDEST}/bin/zt-syno-net-supervise"
SVC_BACKGROUND=y
SVC_WRITE_PID=y

service_prestart ()
{
    # Never let zerotier-one invent a new identity when one exists but cannot be
    # read: the node would come up under a new address, unknown to the network.
    if [ -e "${SYNOPKG_PKGVAR}/identity.secret" ] && [ ! -r "${SYNOPKG_PKGVAR}/identity.secret" ]; then
        echo "ERROR: ${SYNOPKG_PKGVAR}/identity.secret is not readable by $(id -un)."
        echo "The zt-syno-net guard fixes it within 30 seconds."
        exit 1
    fi
    if [ ! -c /dev/net/tun ] || [ ! -w /dev/net/tun ]; then
        echo "ERROR: /dev/net/tun is not ready: is the zt-syno-net boot-up task present in Task Scheduler?"
        exit 1
    fi
    # /bin/getcap is root-only on DSM, so the root guard records in /run the
    # binary it granted the capability to; after an install or upgrade the
    # record no longer matches until the guard has run (within 30 seconds).
    if [ "$(stat -c '%i:%Y:%s' "${ZEROTIER}" 2>/dev/null)" != "$(cat /run/zt-syno-net.caps 2>/dev/null)" ]; then
        echo "ERROR: ${ZEROTIER} has no network capability yet: is the zt-syno-net boot-up task present in Task Scheduler?"
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
