import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useCallback, useEffect, useState } from "react";
import { usePackageId } from "../../hooks/usePackageId";
import type { Cap } from "../../types/Cap";
import VaultListItem from "./VaultListItem";
import { Button } from "@radix-ui/themes";

const VaultList = () => {
  const currentAccount = useCurrentAccount();
  const [isLoadingVaultList, setIsLoadingVaultList] = useState(false);
  const [caps, setCaps] = useState<Cap[]>([]);
  const suiClient = useSuiClient();
  const packageId = usePackageId();

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
        StructType: `${packageId}::access_control::Cap`,
      },
    });
    const caps = res.data
      .map((obj) => {
        const fields = (obj!.data!.content as { fields: any }).fields;
        return {
          id: fields?.id.id,
          acl_id: fields?.acl_id,
        };
      })
      .filter((item) => item !== null) as unknown as Cap[];
    setCaps(caps);
    setIsLoadingVaultList(false);
  }, [currentAccount?.address, packageId, suiClient]);

  useEffect(() => {
    getCapObj();
  }, [getCapObj]);

  return (
    <div>
      <h1>Welcome to the Igloo {currentAccount?.address.slice(0, 6)}</h1>
      <Button>Create new credentials</Button>
      {isLoadingVaultList && <h2>Loading vault...</h2>}
      {!isLoadingVaultList && caps.length ? (
        caps.map((cap) => {
          return (
            <VaultListItem key={cap.id} cap_id={cap.id} acl_id={cap.acl_id} />
          );
        })
      ) : (
        <p>There is no credentials stored in your Igloo. Create a new one</p>
      )}
    </div>
  );
};

export default VaultList;
