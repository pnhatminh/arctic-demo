import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import VaultList from "./VaultList";
import VaultSideTab from "./SideTab/VaultSideTab";
import { Card } from "../ui/card";

const VaultView = () => {
  const currentAccount = useCurrentAccount();
  return (
    <Card className="flex flex-row">
      <VaultSideTab />
      {!currentAccount ? (
        <>
          Please login to your wallet to continue <ConnectButton />
        </>
      ) : (
        <VaultList />
      )}
    </Card>
  );
};

export default VaultView;
