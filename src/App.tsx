import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { LoginForm } from "./LoginForm";
import BlobViewer from "./ViewPassword";
import ACLListViewer from "./ACLListViewer";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
const BLOB_ACL_PACKAGE_ID = import.meta.env.BLOB_ACL_PACKAGE_ID;

export default function App() {
	const account = useCurrentAccount();
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

  return (
    <div>
      <h1>Arctic Dapp</h1>
      <ConnectButton walletFilter={(w) => w.name === "Slush"} />
      {account && <h2>Hello {account.address.slice(0, 6)}</h2>}
      <ACLListViewer suiClient={suiClient} packageId={BLOB_ACL_PACKAGE_ID}/>
      <LoginForm suiClient={suiClient} packageId={BLOB_ACL_PACKAGE_ID} policyIdHex={""} threshold={0}/>
      <BlobViewer />
      </div>
  );
}
