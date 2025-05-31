import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { LoginForm } from "./LoginForm";
export default function App() {
	const account = useCurrentAccount();
  return (
    <div>
      <h1>Arctic Dapp</h1>
      <ConnectButton walletFilter={(w) => w.name === "Slush"} />
      {account && <h2>Hello {account.address.slice(0, 6)}</h2>}
      <LoginForm packageId={""} policyIdHex={""} threshold={0}/>
      </div>
  );
}
