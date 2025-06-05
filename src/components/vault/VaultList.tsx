import { useCurrentAccount } from "@mysten/dapp-kit";

const VaultList = () => {
  const currentAccount = useCurrentAccount();
  return <>Welcome to the Igloo {currentAccount?.address.slice(0, 6)}</>;
};

export default VaultList;
