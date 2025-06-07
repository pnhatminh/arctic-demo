import { useMemo } from "react";
interface UsePackageInfoType {
  packageId: string;
  packageName: string;
}
export function usePackageInfo(): UsePackageInfoType {
  const packageId = import.meta.env.VITE_PACKAGE_ID;
  const packageName = import.meta.env.VITE_PACKAGE_NAME;
  if (!packageId) {
    console.warn(
      "[usePackageInfo] VITE_PACKAGE_ID is not defined in your environment.",
    );
  }
  if (!packageName) {
    console.warn(
      "[usePackageInfo] VITE_PACKAGE_NAME is not defined in your environment.",
    );
  }

  return useMemo(() => {
    return { packageId, packageName };
  }, [packageId, packageName]);
}
