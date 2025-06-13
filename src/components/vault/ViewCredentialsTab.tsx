import { useCredentialsStore } from "@/store/useCredentialsStore";
import { WalrusClient } from "@mysten/walrus";
import { useEffect, useState } from "react";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";
import {
  EncryptedObject,
  getAllowlistedKeyServers,
  NoAccessError,
  SealClient,
  SessionKey,
} from "@mysten/seal";
import {
  useCurrentAccount,
  // useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
} from "@mysten/dapp-kit";
import { usePackageInfo } from "@/hooks/usePackageInfo";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { set } from "idb-keyval";
import type { MoveCallConstructor } from "@/utils/utils";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { Button } from "../ui/button";

const ViewCredentialsTab = () => {
  const { credentials, credentials_id } = useCredentialsStore();
  const { packageId, packageName } = usePackageInfo();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  // const [data, setData] = useState<SharedCredentials>();
  const [error, setError] = useState<string | null>(null);
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null);
  const [sealClient, setSealClient] = useState<SealClient | null>(null);
  const [decryptedData, setDecryptedData] = useState<Uint8Array | null>(null);
  // const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  // const { mutateAsync: signAndExecuteTransaction } =
  //   useSignAndExecuteTransaction();
  useEffect(() => {
    const wc = new WalrusClient({
      network: "testnet",
      suiRpcUrl: "https://fullnode.testnet.sui.io",
      wasmUrl: walrusWasmUrl,
      storageNodeClientOptions: {
        timeout: 60_000,
      },
    });
    const sealClient = new SealClient({
      suiClient,
      serverObjectIds: getAllowlistedKeyServers("testnet").map(
        (id) => [id, 1] as [string, number],
      ),
      verifyKeyServers: false,
    });
    setSealClient(sealClient);
    setWalrusClient(wc);
  }, [suiClient]);

  const constructSealApproveCall: MoveCallConstructor = () => {
    if (!credentials_id) return;
    return (tx: Transaction, id: string) => {
      console.log(`constructMoveCall id ${id}`);
      console.log(`credentials_id ${credentials_id}`);
      tx.moveCall({
        target: `${packageId}::${packageName}::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(`0x${id}`)),
          tx.object(credentials_id),
        ],
      });
    };
  };

  const onDecrypt = async () => {
    if (!walrusClient) {
      console.error("Walrus client is not initialized");
      return;
    }
    if (!sealClient) {
      console.error("Seal client is not initialized");
      return;
    }
    if (!credentials?.blob_id) {
      console.error("BlobID not available");
      return;
    }
    setIsDecrypting(true);
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
      address: currentAccount!.address!,
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
            const moveCallConstructor = constructSealApproveCall;
            const encryptedData = await walrusClient.readBlob({
              blobId: credentials!.blob_id!,
            });
            if (!encryptedData || encryptedData.length === 0) {
              setError("Blob not found or empty");
              return;
            }
            const fullId = EncryptedObject.parse(
              new Uint8Array(encryptedData),
            ).id;
            const tx = new Transaction();
            console.log("fullId", fullId);
            console.log("tx", tx);

            moveCallConstructor(tx, fullId);
            const txBytes = await tx.build({
              client: suiClient,
              onlyTransactionKind: true,
            });
            await sealClient.fetchKeys({
              ids: [fullId],
              txBytes,
              sessionKey,
              threshold: 1,
            });

            try {
              // Note that all keys are fetched above, so this only local decryption is done
              const decryptedData = await sealClient.decrypt({
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
          onSettled: () => {
            setIsDecrypting(false);
          },
        },
      );
    } catch (error: unknown) {
      console.error("Error:", error);
    }
  };

  if (!credentials) return <span>Invalid Credentials object</span>;

  return (
    <>
      {credentials.blob_id ? (
        <>
          <span>{credentials.blob_id}</span>
          <Button onClick={onDecrypt}>Decrypt password</Button>
          {isDecrypting && <span>Decrypting...</span>}
          {decryptedData && <span>{decryptedData}</span>}
          {error && <span>${error}</span>}
        </>
      ) : (
        <span>There is no credentials yet. Please update it here.</span>
      )}
    </>
  );
};

export default ViewCredentialsTab;
