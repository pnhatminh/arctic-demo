// src/LoginForm.tsx
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignTransaction,
} from "@mysten/dapp-kit";
import { getAllowlistedKeyServers, SealClient, type KeyServerConfig, type SealCompatibleClient } from "@mysten/seal";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { WalrusClient } from "@mysten/walrus";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";
import React, { useEffect, useState, type FormEvent } from "react";

interface LoginFormProps {
  packageId: string;
  policyIdHex: string;
  threshold: number;
}

export const LoginForm: React.FC<LoginFormProps> = (
  {
    // packageId,
    // policyIdHex,
    // threshold,
  }
) => {
  const [serviceName, setServiceName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sealClient, setSealClient] = useState<SealClient | null>(null);
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null);
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signTransactionBlock } = useSignTransaction();
  const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

  useEffect(() => {
    (async () => {
      try {
        const allowlistedIds: string[] = getAllowlistedKeyServers("testnet");
        const serverConfigs: KeyServerConfig[] = allowlistedIds.map(id => ({
          objectId: id,
          weight: 1
        }));
        const sc = new SealClient({
          suiClient: suiClient as unknown as SealCompatibleClient,
          serverConfigs,
          verifyKeyServers: false,
        });
        setSealClient(sc);
        setStatus("✅ SealClient initialized.");
      } catch (e: any) {
        console.error(e);
        setStatus(`⚠️ SealClient init error: ${e.message}`);
      }
    })();
  }, []);
  useEffect(() => {
    if (!signTransactionBlock) return;

    try {
      const wc = new WalrusClient({
        network: "testnet",
        suiRpcUrl: "https://fullnode.testnet.sui.io",
        wasmUrl: walrusWasmUrl,
        storageNodeClientOptions: {
          timeout: 60_000,
        },
      });

      setWalrusClient(wc);
      setStatus((prev) =>
        prev ? prev + "\n✅ WalrusClient ready." : "✅ WalrusClient ready."
      );
    } catch (e: any) {
      console.error(e);
      setStatus((prev) =>
        prev
          ? prev + `\n⚠️ Walrus init error: ${e.message}`
          : `⚠️ Walrus init error: ${e.message}`
      );
    }
  }, [signTransactionBlock]);

  const writeFromWallet = async (
    file: Uint8Array<ArrayBufferLike>,
    suiClient: SuiClient,
    walrusClient: WalrusClient,
    currentAccount: any
  ) => {
    const encoded = await walrusClient.encodeBlob(file);
    const wc = new WalrusClient({
      network: "testnet",
      suiRpcUrl: "https://fullnode.testnet.sui.io",
      wasmUrl: walrusWasmUrl,
      storageNodeClientOptions: {
        timeout: 60_000,
      },
    });
    const registerBlobTransaction = wc.registerBlobTransaction({
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

    const blobType = await wc.getBlobType();

    const blobObject = objectChanges?.find(
      (change) => change.type === "created" && change.objectType === blobType
    );

    if (!blobObject || blobObject.type !== "created") {
      throw new Error("Blob object not found");
    }

    const confirmations = await wc.writeEncodedBlobToNodes({
      blobId: encoded.blobId,
      metadata: encoded.metadata,
      sliversByNode: encoded.sliversByNode,
      deletable: true,
      objectId: blobObject.objectId,
    });

    console.log("Confirmations:", confirmations);

    const certifyBlobTransaction = wc.certifyBlobTransaction({
      blobId: encoded.blobId,
      blobObjectId: blobObject.objectId,
      confirmations,
      deletable: true,
    });
    certifyBlobTransaction.setGasBudget(100_000_000);
    certifyBlobTransaction.setSender(currentAccount!.address);

    const { digest: certifyDigest } = await signAndExecuteTransaction({
      transaction: certifyBlobTransaction as any,
    });

    const { effects: certifyEffects } = await suiClient.waitForTransaction({
      digest: certifyDigest,
      options: { showEffects: true },
    });

    if (certifyEffects?.status.status !== "success") {
      console.error("Certification failed:", certifyEffects?.status.error);
      throw new Error(
        `Failed to certify blob: ${certifyEffects?.status.error}`
      );
    }

    return encoded.blobId;
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("🔒 Encrypting credentials…");

    try {
      if (!sealClient) throw new Error("SealClient not ready");
      if (!walrusClient) throw new Error("WalrusClient not ready");
      if (!currentAccount) throw new Error("Wallet not connected");

      const plainJSON = JSON.stringify({ username, password });
      const encoder = new TextEncoder();
      const plainBytes = encoder.encode(plainJSON);

      // const pkgHex = packageId.startsWith("0x") ? packageId : `0x${packageId}`;
      // const policyHex = policyIdHex.startsWith("0x")
      //   ? policyIdHex
      //   : `0x${policyIdHex}`;

      // const { encryptedObject } = await sealClient.encrypt({
      //   threshold,
      //   packageId: pkgHex,
      //   id: policyHex,
      //   data: plainBytes,
      // });

      setStatus((prev) =>
        prev
          ? prev + "\n🔐 Encryption successful. Uploading via wallet helper…"
          : "🔐 Encryption successful. Uploading via wallet helper…"
      );

      const blobId = await writeFromWallet(
        plainBytes,
        suiClient,
        walrusClient,
        currentAccount
      );

      setStatus((prev) =>
        prev
          ? prev + `\n✅ Uploaded! Blob ID: ${blobId}`
          : `✅ Uploaded! Blob ID: ${blobId}`
      );
    } catch (err: any) {
      console.error(err);
      setStatus((prev) =>
        prev ? prev + `\n⚠️ ${err.message}` : `⚠️ ${err.message}`
      );
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white shadow-lg rounded-xl">
      <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">
        Secure Login (Seal → Walrus)
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="serviceName"
            className="block text-gray-700 font-medium mb-1"
          >
            Service Name
          </label>
          <input
            id="serviceName"
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            required
            disabled={!currentAccount || !sealClient || !walrusClient}
            className={`
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-400
              ${
                !currentAccount || !sealClient || !walrusClient
                  ? "bg-gray-100 cursor-not-allowed"
                  : "bg-white"
              }
            `}
          />
          <label
            htmlFor="username"
            className="block text-gray-700 font-medium mb-1"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={!currentAccount || !sealClient || !walrusClient}
            className={`
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-400
              ${
                !currentAccount || !sealClient || !walrusClient
                  ? "bg-gray-100 cursor-not-allowed"
                  : "bg-white"
              }
            `}
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-gray-700 font-medium mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={!currentAccount || !sealClient || !walrusClient}
            className={`
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-400
              ${
                !currentAccount || !sealClient || !walrusClient
                  ? "bg-gray-100 cursor-not-allowed"
                  : "bg-white"
              }
            `}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!currentAccount || !sealClient || !walrusClient}
          className={`
            w-full py-2 text-white font-semibold rounded-lg transition-colors duration-200
            ${
              currentAccount && sealClient && walrusClient
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }
          `}
        >
          {currentAccount && sealClient && walrusClient
            ? "Encrypt & Upload"
            : "Loading…"}
        </button>
      </form>

      {/* Status Message (multi‐line) */}
      {status && (
        <pre className="mt-4 text-center text-sm text-gray-600 whitespace-pre-wrap">
          {status}
        </pre>
      )}
    </div>
  );
};
