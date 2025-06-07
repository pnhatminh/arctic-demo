import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useCallback, useEffect, useState } from "react";
import type { Cap } from "../../types/Cap";
import AddNewCredentials from "./AddNewCredentials";
import VaultListItem from "./VaultListItem";
import { usePackageInfo } from "@/hooks/usePackageInfo";
import { Toaster } from "@/components/ui/sonner";

const VaultList = () => {
  const currentAccount = useCurrentAccount();
  const [isLoadingVaultList, setIsLoadingVaultList] = useState(false);
  const [caps, setCaps] = useState<Cap[]>([]);
  const suiClient = useSuiClient();
  const { packageId, packageName } = usePackageInfo();

  const getCapObj = useCallback(async () => {
    if (!currentAccount?.address) return;
    setIsLoadingVaultList(true);
    const res = await suiClient.getOwnedObjects({
      owner: currentAccount?.address,
      options: {
        showContent: true,
        showType: true,
      },
      filter: {
        StructType: `${packageId}::${packageName}::Cap`,
      },
    });
    console.log(res.data);
    const caps = res.data
      .map((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = (obj!.data!.content as { fields: any }).fields;
        return {
          id: fields?.id.id,
          shared_credentials_id: fields?.shared_credentials_id,
          service_name: fields?.service_name,
        };
      })
      .filter((item) => item !== null) as unknown as Cap[];
    setCaps(caps);
    setIsLoadingVaultList(false);
  }, [currentAccount?.address, packageId, packageName, suiClient]);

  useEffect(() => {
    getCapObj();
  }, [getCapObj]);

  return (
    <div>
      <Toaster />
      <h1>Welcome to the Igloo {currentAccount?.address.slice(0, 6)}</h1>
      <AddNewCredentials getCapObj={getCapObj} />
      {isLoadingVaultList && <h2>Loading vault...</h2>}
      {!isLoadingVaultList &&
        (caps.length ? (
          caps.map((cap) => {
            return (
              <VaultListItem
                key={cap.id}
                cap_id={cap.id}
                shared_credentials_id={cap.acl_id}
                service_name={cap.service_name}
              />
            );
          })
        ) : (
          <p>There is no credentials stored in your Igloo. Create a new one</p>
        ))}
    </div>
  );
};

export default VaultList;
