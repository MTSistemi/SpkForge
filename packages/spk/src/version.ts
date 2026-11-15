// Version handling for packages and DSM.
//
// Package versions follow Synology's "<upstream>-<build>" convention, e.g. "1.16.2-3".
// DSM versions in INFO (os_min_ver / os_max_ver) look like "7.2-64570" or "7.2.2-72806";
// older packages may carry only "7.0".

/** Split a version into comparable numeric and text segments. */
function segments(version: string): (number | string)[] {
  return version
    .trim()
    .split(/[.\-_+~]/)
    .filter((part) => part !== '')
    .flatMap((part) => part.match(/\d+|\D+/g) ?? [])
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
}

/** Compare two package versions. Negative if a < b, zero if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const left = segments(a);
  const right = segments(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i];
    const y = right[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    // A number sorts after text, so "1.0" > "1.0beta".
    if (typeof x === 'number') return 1;
    if (typeof y === 'number') return -1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export interface DsmVersion {
  major: number;
  minor: number;
  micro: number;
  /** Build number (e.g. 72806); undefined when the string carries none. */
  build: number | undefined;
}

/** Parse "7.2", "7.2.2", "7.2-64570" or "7.2.2-72806". Returns undefined if unparsable. */
export function parseDsmVersion(text: string | undefined): DsmVersion | undefined {
  if (!text) return undefined;
  const match = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(\d+))?\s*$/.exec(text);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    micro: Number(match[3] ?? 0),
    build: match[4] === undefined ? undefined : Number(match[4]),
  };
}

/**
 * Compare a NAS DSM version with a requirement from INFO. When both carry a build
 * number the build decides, as Synology build numbers grow monotonically across
 * releases; otherwise major.minor.micro decides.
 */
export function compareDsm(nas: DsmVersion, requirement: DsmVersion): number {
  if (nas.build !== undefined && requirement.build !== undefined) return nas.build - requirement.build;
  return nas.major - requirement.major || nas.minor - requirement.minor || nas.micro - requirement.micro;
}
