SPK_NAME = zt-syno-net
SPK_VERS = 1.16.2
SPK_REV = 2
SPK_ICON = src/zt-syno-net.png

DEPENDS = cross/zerotier

REQUIRED_MIN_DSM = 7.0

MAINTAINER = MTSistemi
DESCRIPTION = ZeroTier One: join this NAS to your ZeroTier networks. Runs without root and needs no other package: a one-time boot-up task, explained in the install wizard, grants the network capability.
DESCRIPTION_ITA = ZeroTier One: collega questo NAS alle tue reti ZeroTier. Gira senza root e non richiede altri pacchetti: un\'attività all\'avvio da creare una volta, spiegata nella procedura di installazione, concede il permesso di rete.
DISPLAY_NAME = ZeroTier
CHANGELOG = "1. ZeroTier One 1.16.2. 2. The install wizard creates the root boot-up task itself, and a supervisor restarts the service if it stops."
HOMEPAGE = https://www.zerotier.com
LICENSE = MPL-2.0
STARTABLE = yes

WIZARDS_DIR = src/wizard/

SERVICE_USER = auto
SERVICE_SETUP = src/service-setup.sh
FWPORTS = src/zt-syno-net.sc

SPK_COMMANDS = bin/zerotier-cli

POST_STRIP_TARGET = zt-syno-net_extra_install

include ../../mk/spksrc.spk.mk

.PHONY: zt-syno-net_extra_install
zt-syno-net_extra_install:
	install -m 755 -d $(STAGING_DIR)/bin
	install -m 755 src/zerotier-cli $(STAGING_DIR)/bin/zerotier-cli
	install -m 755 src/zt-syno-net-supervise $(STAGING_DIR)/bin/zt-syno-net-supervise
	install -m 755 src/zt-syno-net-guard $(STAGING_DIR)/bin/zt-syno-net-guard
