import { useCurrentAccount } from "@mysten/dapp-kit";
import {
    EncryptedObject,
  getAllowlistedKeyServers,
  NoAccessError,
  SealClient,
  SessionKey,
  type SealCompatibleClient,
  type SessionKeyType,
} from "@mysten/seal";
import type { SuiClient } from "@mysten/sui/client";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePackageId } from "./hooks/usePackageId";
import type { MoveCallConstructor } from "./utils/utils";
import { WalrusClient } from "@mysten/walrus";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";
import { useSignPersonalMessage } from "@mysten/dapp-kit";

interface ACLItemViewerProps {
  suiClient: SuiClient;
}

export interface ACLItemData {
  allowlistId: string;
  allowlistName: string;
  blobId: string;
}

function constructMoveCall(
  packageId: string,
  allowlistId: string
): MoveCallConstructor {
  return (tx: Transaction, id: string) => {
    tx.moveCall({
      target: `${packageId}::allowlist::seal_approve`,
      arguments: [tx.pure.vector("u8", fromHex(id)), tx.object(allowlistId)],
    });
  };
}

const ACLItemViewer = ({ suiClient }: ACLItemViewerProps) => {
  const packageId = usePackageId();
  const { id } = useParams();
  const currentAccount = useCurrentAccount();
  const [data, setData] = useState<ACLItemData>();
  const allowerListedKeyServers: string[] = getAllowlistedKeyServers("testnet");
  const [error, setError] = useState<string | null>(null);
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null);
  const [decryptedData, setDecryptedData] = useState<Uint8Array | null>(null);
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const seal = new SealClient({
    suiClient: suiClient as unknown as SealCompatibleClient,
    serverObjectIds: getAllowlistedKeyServers("testnet").map(
      (id) => [id, 1] as [string, number]
    ),
    verifyKeyServers: false,
  });

  useEffect(() => {
    const wc = new WalrusClient({
      network: "testnet",
      suiRpcUrl: "https://fullnode.testnet.sui.io",
      wasmUrl: walrusWasmUrl,
      storageNodeClientOptions: {
        timeout: 60_000,
      },
    });
    setWalrusClient(wc);
  }, []);

  async function getData() {
    const allowlist = await suiClient.getObject({
      id: id!,
      options: { showContent: true },
    });
    const encryptedObjects = await suiClient
      .getDynamicFields({
        parentId: id!,
      })
      .then((res: { data: any[] }) =>
        res.data.map((obj) => obj.name.value as string)
      );
    const fields = (allowlist.data?.content as { fields: any })?.fields || {};
    const feedData = {
      allowlistId: id!,
      allowlistName: fields?.name,
      blobId: encryptedObjects[0] || "",
    };
    setData(feedData);
  }

  const onView = async (blob_id: string, acl_id: string) => {
    if (!walrusClient) {
      console.error("Walrus client is not initialized");
      return;
    }
    // const imported: SessionKeyType | undefined = await get("sessionKey");

    // if (imported) {
    //   const currentSessionKey = await SessionKey.import(imported, {
    //     client: new SuiGraphQLClient({
    //       url: "https://sui-testnet.mystenlabs.com/graphql",
    //     }),
    //   });
    //   console.log("loaded currentSessionKey", currentSessionKey);
    //   if (
    //     currentSessionKey &&
    //     !currentSessionKey.isExpired() &&
    //     currentSessionKey.getAddress() === currentAccount?.address
    //   ) {
    //     const moveCallConstructor = constructMoveCall(packageId, allowlistId);

    //     return;
    //   }
    // }

    set("sessionKey", null);

    const sessionKey = new SessionKey({
      address: currentAccount?.address!,
      packageId,
      ttlMin: 10,
      client: new SuiGraphQLClient({
        url: "https://sui-testnet.mystenlabs.com/graphql",
      }),
    });

    try {
      signPersonalMessage(
        {
          message: sessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result: { signature: string }) => {
            await sessionKey.setPersonalMessageSignature(result.signature);
            const moveCallConstructor = await constructMoveCall(
              packageId,
              acl_id
            );
            const encryptedData = await walrusClient.readBlob({ blobId: blob_id });
            if (!encryptedData || encryptedData.length === 0) {
              setError("Blob not found or empty");
              return;
            }
            const fullId = EncryptedObject.parse(
              new Uint8Array(encryptedData)
            ).id;
            const tx = new Transaction();
            moveCallConstructor(tx, fullId);
            const txBytes = await tx.build({
              client: suiClient,
              onlyTransactionKind: true,
            });
            try {
              // Note that all keys are fetched above, so this only local decryption is done
              const decryptedData = await seal.decrypt({
                data: new Uint8Array(encryptedData),
                sessionKey,
                txBytes,
              });
              setDecryptedData(decryptedData);
            } catch (err) {
              console.log(err);
              const errorMsg =
                err instanceof NoAccessError
                  ? "No access to decryption keys"
                  : "Unable to decrypt files, try again";
              console.error(errorMsg, err);
              setError(errorMsg);
              return;
            }
            set("sessionKey", sessionKey.export());
          },
        }
      );
    } catch (error: any) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    getData();
  }, [id, suiClient, packageId]);

  return <></>;
};

export default ACLItemViewer;
