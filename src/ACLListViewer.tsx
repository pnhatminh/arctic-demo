import { useCurrentAccount } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useCallback, useEffect, useState } from "react";
import { Button, Card } from '@radix-ui/themes';

interface ACLListViewerProps {
  packageId: string;
  suiClient: SuiClient;
}

export interface Cap {
  id: string;
  acl_id: string;
}

export interface CardItem {
  cap_id: string;
  acl_id: string;
  allow_list: string[];
  name: string;
}

const ACLListViewer = ({ packageId, suiClient }: ACLListViewerProps) => {
  const account = useCurrentAccount();
  const [cardItems, setCardItems] = useState<CardItem[]>([]);

  const getCapObj = useCallback(async () => {
    if (!account?.address) return;

    const res = await suiClient.getOwnedObjects({
      owner: account?.address,
      options: {
        showContent: true,
        showType: true,
      },
      filter: {
        StructType: `${packageId}::allowlist::Cap`,
      },
    });
    const caps = res.data
      .map((obj) => {
        const fields = (obj!.data!.content as { fields: any }).fields;
        return {
          id: fields?.id.id,
          allowlist_id: fields?.allowlist_id,
        };
      })
      .filter((item) => item !== null) as unknown as Cap[];
    const cardItems: CardItem[] = await Promise.all(
      caps.map(async (cap) => {
        const allowlist = await suiClient.getObject({
          id: cap.acl_id,
          options: { showContent: true },
        });
        const fields =
          (allowlist.data?.content as { fields: any })?.fields || {};
        return {
          cap_id: cap.id,
          acl_id: cap.acl_id,
          allow_list: fields.allow_list,
          name: fields.name,
        };
      })
    );
    setCardItems(cardItems);
  }, [account?.address]);

  useEffect(() => {
    getCapObj();
  }, [getCapObj]);
  return (
    <>
      {cardItems.map((item) => (
        <Card key={`${item.cap_id} - ${item.acl_id}`}>
          <p>
            {item.name} (ID {item.name})
          </p>
          <Button
            onClick={() => {
              window.open(
                `${window.location.origin}/acl/${item.acl_id}`,
                "_blank"
              );
            }}
          >
            Manage
          </Button>
        </Card>
      ))}
    </>
  );
};

export default ACLListViewer;
