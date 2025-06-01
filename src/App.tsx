import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ACLItemViewer from "./ACLItemViewer";
import ACLListViewer from "./ACLListViewer";

export default function App() {
  const account = useCurrentAccount();
  const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

  return (
    <div>
      <div className="header place-items-center">
        <h1>Arctic Dapp</h1>
        <ConnectButton walletFilter={(w) => w.name === "Slush"} />
        {account && <h2>Hello {account.address.slice(0, 6)}</h2>}
      </div>
      {account && (
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <ACLListViewer
                    suiClient={suiClient}
                  />
                </>
              }
            />
            <Route
              path="/acl/:id"
              element={
                <>
                  <ACLItemViewer
                    suiClient={suiClient}
                  />
                </>
              }
            />
          </Routes>
        </BrowserRouter>
      )}
    </div>
  );
}
