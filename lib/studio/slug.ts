/**
 * Folder names, derived from what a composition is called.
 *
 * The folder is what someone sees in Finder, so it has to say what the thing
 * is. A composition called "First video" living in a folder called `untitled`
 * is a filing system that actively lies to you, and after three of them nobody
 * can tell which is which.
 *
 * So the slug always follows the name. That means renaming a composition
 * renames its folder on disk — see `renameProjectFolder` in
 * lib/workspace/fs.ts for how, and why it is not as simple as it sounds.
 */

/** Matches `SlugSchema`: lowercase, digits and dashes, starting alphanumeric. */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      // Strip the combining marks NFKD just separated out, so "Café" becomes
      // "cafe" rather than losing the whole word to the alphanumeric filter.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .slice(0, 48)
      // The slice can land mid-dash, and a trailing one is ugly in a path.
      .replace(/-+$/, "")
  );
}

/**
 * The first free variant of a slug.
 *
 * Numbered rather than hashed: these are folder names in someone's
 * repository, and `first-video-2` is a thing a person can find again.
 * `first-video-m8f2k1` is not.
 */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    // Keep the whole thing inside the 48-character limit even after the
    // suffix, or a long name would produce a slug the schema rejects.
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 48 - suffix.length)}${suffix}`;
    if (!taken.includes(candidate)) return candidate;
  }

  return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
}

/**
 * What a composition's folder should be called, given its name and what else
 * is in the workspace. Null when the name has nothing usable in it — "!!!"
 * slugifies to nothing, and an unnamed folder is worse than a stale one.
 */
export function slugForName(
  name: string,
  taken: readonly string[],
): string | null {
  const base = slugify(name);
  if (base.length === 0) return null;
  return uniqueSlug(base, taken);
}
