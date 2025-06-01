import { useEffect, useState } from "react";
import { WalrusClient } from "@mysten/walrus";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";

export default function BlobViewer() {
  const [blobId, setBlobId] = useState("");
  const [dataText, setDataText] = useState<string | null>(null); // holds decoded text if the blob is text
  const [dataUrl, setDataUrl] = useState<string | null>(null); // holds object URL if the blob is binary (e.g. image)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null);

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

  const fetchBlobData = async () => {
    if (!walrusClient) {
      setError("Walrus client not initialized");
      return;
    }
    setLoading(true);
    setError(null);
    setDataText(null);
    setDataUrl(null);

    try {
      const blobBytes = await walrusClient.readBlob({ blobId });
      if (!blobBytes || blobBytes.length === 0) {
        setError("Blob not found or empty");
        return;
      }
      let decodedString;
      try {
        const decoder = new TextDecoder("utf-8");
        decodedString = decoder.decode(blobBytes);
      } catch (decErr) {
        decodedString = null;
      }

      if (decodedString && isProbablyText(decodedString)) {
        setDataText(decodedString);
      } else {
        const blob = new Blob([blobBytes]);
        const url = URL.createObjectURL(blob);
        setDataUrl(url);
      }
    } catch (err) {
      console.error("Error fetching blob:", err);
      setError(JSON.stringify(err) || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  function isProbablyText(text: string) {
    // Check for presence of many control characters. If few, we assume text.
    const controlChars = text.match(/[\x00-\x08\x0E-\x1F]/g);
    return !controlChars || controlChars.length < 5;
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 16 }}>
      <h2>Walrus Blob Viewer</h2>

      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor="blobIdInput"
          style={{ display: "block", marginBottom: 4 }}
        >
          Enter Blob ID:
        </label>
        <input
          id="blobIdInput"
          type="text"
          value={blobId}
          onChange={(e) => setBlobId(e.target.value.trim())}
          placeholder="e.g. 0x1234abcd…"
          style={{ width: "100%", padding: 8, fontSize: 16 }}
        />
      </div>

      <button
        onClick={fetchBlobData}
        disabled={!blobId || loading}
        style={{
          padding: "8px 16px",
          fontSize: 16,
          cursor: blobId && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Fetching..." : "Fetch Blob"}
      </button>

      {error && (
        <div style={{ marginTop: 16, color: "red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {dataText && (
        <div style={{ marginTop: 24 }}>
          <h3>Blob Content (Text)</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 4,
            }}
          >
            {dataText}
          </pre>
        </div>
      )}

      {dataUrl && (
        <div style={{ marginTop: 24 }}>
          <h3>Blob Content (Binary)</h3>
          {/* If it’s an image, the <img> will render it. For other types, the link lets you download/view. */}
          <div>
            <img
              src={dataUrl}
              alt="Blob Preview"
              style={{
                maxWidth: "100%",
                maxHeight: 400,
                display: "block",
                marginBottom: 8,
              }}
              onError={(e) => {
                // If it fails to load as an image, do nothing—fallback to link.
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <a
              href={dataUrl}
              download={`blob_${blobId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Blob
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
