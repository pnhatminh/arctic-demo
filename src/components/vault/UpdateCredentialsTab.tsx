import { usePackageInfo } from "@/hooks/usePackageInfo";
import { UseWalrusServices } from "@/hooks/useWalrusServices";
import { useCredentialsStore } from "@/store/useCredentialsStore";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { getAllowlistedKeyServers, SealClient } from "@mysten/seal";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Transaction } from "@mysten/sui/transactions";

const UpdateCredentialsTab = () => {
  const NUM_EPOCH = 1;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const suiClient = useSuiClient();
  const sealClient = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers("testnet").map(
      (id) => [id, 1] as [string, number],
    ),
    verifyKeyServers: false,
  });
  const { credentials_id, cap_id } = useCredentialsStore();
  const [status, setStatus] = useState<string | null>(null);
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
  const { getPublisherUrl } = UseWalrusServices();

  const storeBlob = async (encryptedData: Uint8Array) => {
    const response = await fetch(
      `${getPublisherUrl("service1", `/v1/blobs?epochs=${NUM_EPOCH}`)}`,
      {
        method: "PUT",
        body: encryptedData,
      },
    );
    if (response.status === 200) {
      return response.json().then((info) => {
        return { info };
      });
    } else {
      setStatus("Failed to upload to blob. Please try again");
      throw new Error("Something went wrong when storing the blob!");
    }
  };

  const handlePublish = async (blobId: string | null) => {
    if (!credentials_id || !cap_id || !blobId) return;
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::${packageName}::publish`,
      arguments: [
        tx.object(credentials_id),
        tx.object(cap_id),
        tx.pure.string(blobId),
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
          setStatus(
            "Blob attached successfully, now share the link or upload more.",
          );
        },
        onError: async (error) => {
          console.error("error: ", error);
          setStatus("Failed to attach blob. Please try again");
        },
      },
    );
  };

  const onSave = async () => {
    if (!credentials_id) return;
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
    setStatus("Finalizing...");
    const storageInfo = await storeBlob(encryptedObject);
    let blobId: string | null = null;
    if ("alreadyCertified" in storageInfo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blobId = (storageInfo.alreadyCertified as any).blobId;
    } else if ("newlyCreated" in storageInfo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blobId = (storageInfo.newlyCreated as any).blobId;
    }
    await handlePublish(blobId);
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
