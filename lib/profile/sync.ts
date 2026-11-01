// StructuredProfile <-> VaultProfile mapping. The five-field quick profile
// (name, headline, location, targetRole, links) keeps working; the structured
// profile only ever contributes its contact fields to it.
import type { VaultProfile } from "../engine/types";
import type { StructuredProfile } from "./schema";

/** Contact name, location and links flow to the quick profile; headline and targetRole stay as the user set them. A blank structured value never wipes an existing one. */
export function toVaultProfile(p: StructuredProfile, existing: VaultProfile): VaultProfile {
  const name = p.contact.name.trim();
  const location = p.contact.location.trim();
  const links = p.contact.links.map((l) => l.trim()).filter(Boolean).join(", ");
  return {
    ...existing,
    name: name || existing.name,
    location: location || existing.location,
    links: links || existing.links,
  };
}

/** Writes the quick profile's name, location and links into the contact block; roles, education, skills and projects are untouched. */
export function applyQuickProfile(p: StructuredProfile, quick: VaultProfile): StructuredProfile {
  const links = [...new Set(quick.links.split(/[\s,]+/).map((l) => l.trim().slice(0, 300)).filter(Boolean))].slice(0, 10);
  return {
    ...p,
    contact: {
      ...p.contact,
      name: quick.name.trim() || p.contact.name,
      location: quick.location.trim() || p.contact.location,
      links: links.length ? links : p.contact.links,
    },
  };
}
