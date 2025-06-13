import { usePackageInfo } from "@/hooks/usePackageInfo";
import { useCredentialsStore } from "@/store/useCredentialsStore";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { getAllowlistedKeyServers, SealClient } from "@mysten/seal";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { WalrusClient } from "@mysten/walrus";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from "sonner";

interface UpdateCredentialsTabProps {
  reloadCredentials: () => void;
}
const UpdateCredentialsTab = ({
  reloadCredentials,
}: UpdateCredentialsTabProps) => {
  const currentAccount = useCurrentAccount();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sealClient, setSealClient] = useState<SealClient | null>(null);
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null);
  const suiClient = useSuiClient();

  const { credentials_id, cap_id } = useCredentialsStore();
  const [status, setStatus] = useState<string | null>(null);
  const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });
  const { packageId, packageName } = usePackageInfo();

  useEffect(() => {
    const sealClient = new SealClient({
      suiClient,
      serverObjectIds: getAllowlistedKeyServers("testnet").map(
        (id) => [id, 1] as [string, number],
      ),
      verifyKeyServers: false,
    });
    const walrusClient = new WalrusClient({
      network: "testnet",
      suiRpcUrl: "https://fullnode.testnet.sui.io",
      wasmUrl: walrusWasmUrl,
      storageNodeClientOptions: {
        timeout: 60_000,
      },
    });
    setSealClient(sealClient);
    setWalrusClient(walrusClient);
  }, [suiClient]);

  const writeFromWallet = async (file: Uint8Array<ArrayBufferLike>) => {
    if (!walrusClient) {
      setStatus("Failed to setup walrus client");
      return;
    }
    const encoded = await walrusClient.encodeBlob(file);

    const registerBlobTransaction = walrusClient.registerBlobTransaction({
      blobId: encoded.blobId,
      rootHash: encoded.rootHash,
      size: file.length,
      epochs: 1,
      deletable: true,
      owner: currentAccount!.address,
    });
    registerBlobTransaction.setGasBudget(100_000_000);
    registerBlobTransaction.setSender(currentAccount!.address);
    const { digest } = await signAndExecuteTransaction({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction: registerBlobTransaction as any,
    });

    const { objectChanges, effects } = await suiClient.waitForTransaction({
      digest,
      options: { showObjectChanges: true, showEffects: true },
    });

    if (effects?.status.status !== "success") {
      console.error("Transaction failed:", effects?.status.error);
      throw new Error(`Failed to register blob: ${effects?.status.error}`);
    }

    const blobType = await walrusClient.getBlobType();

    const blobObject = objectChanges?.find(
      (change) => change.type === "created" && change.objectType === blobType,
    );

    if (!blobObject || blobObject.type !== "created") {
      throw new Error("Blob object not found");
    }

    const confirmations = await walrusClient.writeEncodedBlobToNodes({
      blobId: encoded.blobId,
      metadata: encoded.metadata,
      sliversByNode: encoded.sliversByNode,
      deletable: true,
      objectId: blobObject.objectId,
    });

    console.log("Confirmations:", confirmations);

    const certifyBlobTransaction = walrusClient.certifyBlobTransaction({
      blobId: encoded.blobId,
      blobObjectId: blobObject.objectId,
      confirmations,
      deletable: true,
    });
    certifyBlobTransaction.setGasBudget(100_000_000);
    certifyBlobTransaction.setSender(currentAccount!.address);

    const { digest: certifyDigest } = await signAndExecuteTransaction({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction: certifyBlobTransaction as any,
    });

    const { effects: certifyEffects } = await suiClient.waitForTransaction({
      digest: certifyDigest,
      options: { showEffects: true },
    });

    if (certifyEffects?.status.status !== "success") {
      console.error("Certification failed:", certifyEffects?.status.error);
      throw new Error(
        `Failed to certify blob: ${certifyEffects?.status.error}`,
      );
    }
    return encoded.blobId;
  };

  async function handlePublish(blob_id: string) {
    if (!credentials_id || !cap_id) {
      setStatus("Failed to publish the blobID");
      console.error(
        `CredentialsID ${credentials_id} or CapID ${cap_id} was invalid`,
      );
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::${packageName}::publish_blob_id`,
      arguments: [
        tx.object(credentials_id),
        tx.object(cap_id),
        tx.pure.string(blob_id),
      ],
    });

    tx.setGasBudget(10000000);
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log("res", result);
          alert(
            "Blob attached successfully, now share the link or upload more.",
          );
        },
      },
    );
  }

  const onSave = async () => {
    if (!credentials_id || !sealClient) return;
    setStatus("Encrypting the credentials ...");
    const plainJSON = JSON.stringify({ username, password });
    const encoder = new TextEncoder();
    const plainBytes = encoder.encode(plainJSON);

    const { encryptedObject } = await sealClient.encrypt({
      threshold: 2,
      packageId,
      id: credentials_id,
      data: plainBytes,
    });
    setStatus("Uploading the encrypted credentials ...");
    let blobId = null;
    try {
      blobId = await writeFromWallet(encryptedObject);
    } catch (err) {
      setStatus("Failed to upload blob");
      console.error("Failed to write to walrus", err);
      return;
    }
    if (!blobId) {
      setStatus("Failed to upload blob");
      console.error("BlobID doesn't exist");
      return;
    }
    setStatus("Finalizing...");
    await handlePublish(blobId);
    toast("Successfully updated the credentials info.");
    reloadCredentials();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username-1">Name</Label>
        <Input
          id="username-1"
          name="username"
          placeholder="john@doe.com"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password-1">Password</Label>
        <Input
          id="password-1"
          name="password"
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
        />
      </div>
      {status && <span>{status}</span>}
      <Button onClick={onSave}>Save changes</Button>
    </div>
  );
};

export default UpdateCredentialsTab;
