'use client';

import GalaxyBackdrop from '@/components/galaxy-backdrop';

/**
 * One persistent, shared galaxy for the entire application.
 * Mounted exactly once in the root layout so public, authenticated,
 * existing and future routes inherit the same atmosphere without adding
 * route-specific canvases or rebuilding the effect on navigation.
 */
export default function WorkspaceBackdrop() {
  return <GalaxyBackdrop />;
}
