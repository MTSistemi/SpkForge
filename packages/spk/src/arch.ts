// DSM 7 platforms and the CPU family each belongs to.
// A package's INFO `arch` lists platforms, families, or "noarch".

export type Family = 'x86_64' | 'armv8' | 'armv7' | 'i686';

const PLATFORMS: Record<Family, readonly string[]> = {
  x86_64: [
    'apollolake', 'avoton', 'braswell', 'broadwell', 'broadwellnk', 'broadwellnkv2',
    'broadwellntbap', 'bromolow', 'cedarview', 'denverton', 'epyc7002', 'epyc7003',
    'epyc7003ntb', 'geminilake', 'geminilakenk', 'grantley', 'icelaked', 'kvmx64',
    'purley', 'r1000', 'r1000nk', 'v1000', 'v1000nk', 'x86_64',
  ],
  armv8: ['armada37xx', 'rtd1296', 'rtd1619b', 'armv8', 'aarch64'],
  armv7: ['alpine', 'alpine4k', 'armada38x', 'monaco', 'armv7'],
  i686: ['evansport', 'i686'],
};

const FAMILY_OF = new Map<string, Family>();
for (const [family, platforms] of Object.entries(PLATFORMS) as [Family, readonly string[]][]) {
  for (const platform of platforms) FAMILY_OF.set(platform, family);
}

/** Aliases some packaging tools write instead of the canonical family name. */
const FAMILY_ALIASES: Record<string, Family> = { x64: 'x86_64', aarch64: 'armv8' };

export function familyOf(platform: string): Family | undefined {
  return FAMILY_OF.get(platform.toLowerCase());
}

export function knownPlatforms(): string[] {
  return [...FAMILY_OF.keys()].filter((name) => !(name in PLATFORMS) && !(name in FAMILY_ALIASES)).sort();
}

/** Split an INFO `arch` value ("x86_64 armv8", "geminilake apollolake") into tokens. */
export function parseArchList(value: string | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((token) => token !== '');
}

/** True when a package built for `archList` installs on `platform`. */
export function archMatches(archList: readonly string[], platform: string): boolean {
  const target = platform.toLowerCase();
  const family = familyOf(target);
  return archList.some((token) => {
    if (token === 'noarch' || token === target) return true;
    const tokenFamily = FAMILY_ALIASES[token] ?? (token in PLATFORMS ? (token as Family) : undefined);
    return tokenFamily !== undefined && tokenFamily === family;
  });
}
