import { notFound } from "next/navigation";
import { DevStudio } from "./DevStudio";

/**
 * The editor, seeded — development only.
 *
 * A real composition only ever comes from a folder the person picks, and the
 * folder picker is a native dialog nothing can drive: not a test runner, not
 * a browser automation, not a screenshot tool. That leaves every panel that
 * shows real data — the process with stages in it, the storyboard, the
 * timeline with clips — unreachable to anything but a person with a mouse.
 *
 * This route seeds the store with an invented film and renders the editor
 * over it, so the chrome can be looked at and driven with data in it. It
 * writes nothing: no folder is linked, so persistence returns early. It does
 * not exist in production — the app ships no sample content, and a demo film
 * would be mistaken for one.
 */
export default function DevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevStudio />;
}
