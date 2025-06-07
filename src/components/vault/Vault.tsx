import { useCurrentAccount } from "@mysten/dapp-kit";
import { Card } from "../ui/card";
import VaultSideTab from "./SideTab/VaultSideTab";
import VaultList from "./VaultList";

const VaultView = () => {
  const currentAccount = useCurrentAccount();
  return (
    <Card className="flex flex-row p-8 gap-8">
      <VaultSideTab />
      {!currentAccount ? (
        <>Please login to your wallet to continue</>
      ) : (
        <VaultList />
      )}
    </Card>
  );
};

export default VaultView;
