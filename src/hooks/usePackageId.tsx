import { useMemo } from 'react';

export function usePackageId(): string {
  const raw = import.meta.env.VITE_BLOB_ACL_PACKAGE_ID;

  if (!raw) {
    console.warn(
      '[usePackageId] VITE_BLOB_ACL_PACKAGE_ID is not defined in your environment.'
    );
  }

  return useMemo(() => raw, [raw]);
}
