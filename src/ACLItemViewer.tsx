import { useCurrentAccount, useSignAndExecuteTransaction, useSignPersonalMessage } from "@mysten/dapp-kit";
import {
  EncryptedObject,
  getAllowlistedKeyServers,
  NoAccessError,
  SealClient,
  SessionKey,
  type SealCompatibleClient,
} from "@mysten/seal";
import type { SuiClient } from "@mysten/sui/client";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { WalrusClient } from "@mysten/walrus";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";
import { Button, Spinner } from "@radix-ui/themes";
import { set } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Cap } from "./ACLListViewer";
import { usePackageId } from "./hooks/usePackageId";
import { LoginForm } from "./LoginForm";
import type { MoveCallConstructor } from "./utils/utils";

interface ACLItemViewerProps {
  suiClient: SuiClient;
}

export interface ACLItemData {
  allowlistId: string;
  allowlistName: string;
  blobId: string;
  owner: string;
  allowlist: string[]
}

function constructSealApproveCall(
  packageId: string,
  allowlistId: string
): MoveCallConstructor {
  return (tx: Transaction, id: string) => {
    console.log(`constructMoveCall id ${id}`);
    console.log(`allowlistId ${allowlistId}`);
    tx.moveCall({
      target: `${packageId}::access_control::seal_approve`,
      arguments: [
        tx.pure.vector("u8", fromHex(`0x${id}`)),
        tx.object(allowlistId),
      ],
    });
  };
}

const ACLItemViewer = ({ suiClient }: ACLItemViewerProps) => {
  const packageId = usePackageId();
  const { id } = useParams();
  const currentAccount = useCurrentAccount();
  const [data, setData] = useState<ACLItemData>();
  const [error, setError] = useState<string | null>(null);
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null);
  const [decryptedData, setDecryptedData] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [capId, setCapId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [addAddressSuccess, setAddAddressSuccess] = useState<string | null>(null);
const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();
    
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

  async function getACLObj() {
    setIsLoading(true);
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
      allowlistName: fields?.service_name,
      allowlist: fields?.allow_list,
      blobId: encryptedObjects[0] || "",
      owner: fields?.owner,
    };
    setData(feedData);
    setIsLoading(false);
  }

  const getCapObj = useCallback(async () => {
    if (!currentAccount?.address) return;
    setIsLoading(true);
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
    console.log(res.data);
    const [cap] = res.data
      .map((obj) => {
        const fields = (obj!.data!.content as { fields: any }).fields;
        return {
          id: fields?.id.id,
          acl_id: fields?.acl_id,
        };
      })
      .filter(
        (item) => item !== null && item.acl_id === id
      ) as unknown as Cap[];
    setCapId(cap?.id);
  }, [currentAccount?.address]);

  const onView = async (blob_id: string, acl_id: string) => {
    if (!walrusClient) {
      console.error("Walrus client is not initialized");
      return;
    }
    // setIsDecrypting(true);
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
            const moveCallConstructor = constructSealApproveCall(
              packageId,
              acl_id
            );
            const encryptedData = await walrusClient.readBlob({
              blobId: blob_id,
            });
            if (!encryptedData || encryptedData.length === 0) {
              setError("Blob not found or empty");
              return;
            }
            const fullId = EncryptedObject.parse(
              new Uint8Array(encryptedData)
            ).id;
            const tx = new Transaction();
            console.log("fullId", fullId);
            console.log("tx", tx);

            moveCallConstructor(tx, fullId);
            const txBytes = await tx.build({
              client: suiClient,
              onlyTransactionKind: true,
            });
            await seal.fetchKeys({
              ids: [fullId],
              txBytes,
              sessionKey,
              threshold: 1,
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
            } finally {
              setIsDecrypting(false);
            }
            set("sessionKey", sessionKey.export());
          },
        }
      );
    } catch (error: any) {
      console.error("Error:", error);
    }
  };

  const onUpdateAddressPermission = async (acl_id: string, cap_id: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::access_control::add_access`,
      arguments: [
        tx.object(acl_id),
        tx.object(cap_id),
        tx.pure.address(address),
      ],
    });
    tx.setGasBudget(100_000_000);
    tx.setSender(currentAccount!.address);
    const { digest } = await signAndExecuteTransaction({
      transaction: tx as any,
    });
    const { effects } = await suiClient.waitForTransaction({
      digest,
      options: { showObjectChanges: true, showEffects: true },
    });
    if (effects?.status.status === "success") {
      setAddAddressSuccess("Successfully added address to allowlist");
    } else {
      setAddAddressSuccess("Failed to add address to allowlist");
    }
  }

  useEffect(() => {
    init();
  }, [id, suiClient, packageId]);
  
  useEffect(() => {
    console.log(showAddAddress, capId, showAddAddress && capId);
  } , [showAddAddress, capId]);

  const init = async () => {
    setIsLoading(true);
    await getACLObj();
    await getCapObj();
    setIsLoading(false);
  };

  return (
    <>
      {!currentAccount && (
        <span>Please connect to wallet to view this shared password</span>
      )}
      {isLoading && (
        <p>
          <Spinner />
          Loading...
        </p>
      )}
      {currentAccount && id && data && (
        <div>
          <h2>Allowlist: {data.allowlistName}</h2>
          <p>Allowlist ID: {data.allowlistId}</p>
          <p>Blob ID: {data.blobId}</p>
          <p>Owner: {data.owner}</p>
          {data.blobId && (data.allowlist.includes(currentAccount?.address) || data.owner === currentAccount.address) && (
            <button
              onClick={() => onView(data.blobId, data.allowlistId)}
              disabled={!walrusClient}
            >
              View password
            </button>
          )}
          {currentAccount.address === data.owner && (
            <Button onClick={() => setShowAddAddress(true)}>Add access</Button>
          )}
          {currentAccount.address === data.owner && !data.blobId && (
            <Button onClick={() => setShowLoginForm(true)}>Add Password</Button>
          )}
          {!data.blobId && <p>No password found for this allowlist.</p>}
          {showAddAddress && capId && (
            <>
              <label
                htmlFor="username"
                className="block text-gray-700 font-medium mb-1"
              >
                Address
              </label>
              <input
                id="username"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className={`
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-400
            `}
              />
              <Button onClick={() => onUpdateAddressPermission(data.allowlistId, capId)}>Update Address Permission</Button>
              {addAddressSuccess && (
                <p style={{ color: "green" }}>{addAddressSuccess}</p>
              )}
            </>
          )}
          {showLoginForm && capId && (
            <LoginForm
              suiClient={suiClient}
              acl_id={data.allowlistId}
              cap_id={capId}
              init={init}
            />
          )}
          {isDecrypting && (
            <p>
              Decrypting...
              <Spinner />
            </p>
          )}
          {decryptedData && (
            <div>
              <h3>Decrypted Data:</h3>
              <pre>{new TextDecoder().decode(decryptedData)}</pre>
            </div>
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      )}
    </>
  );
};

export default ACLItemViewer;
