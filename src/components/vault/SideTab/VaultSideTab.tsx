import { useState } from "react";
import VaultSideTabItem from "./VaultSideTabItem";
import { ConnectButton } from "@mysten/dapp-kit";

export type Tabs = "all" | "owned" | "shared" | "favourites";

const VaultSideTab = () => {
  const [currentActiveTab, setCurrentActiveTab] = useState<Tabs>("all");
  const onVaultSideTabItemClick = (tab: Tabs) => {
    if (currentActiveTab === tab) return;
    setCurrentActiveTab(tab);
  };
  return (
    <div className="p-4">
      <h1>Arctic</h1>
      <ul>
        <VaultSideTabItem
          title="All items"
          icon=""
          onClick={onVaultSideTabItemClick}
          isActive={currentActiveTab === "all"}
          tabType="all"
        />
        <VaultSideTabItem
          title="My created credentials"
          icon=""
          onClick={onVaultSideTabItemClick}
          isActive={currentActiveTab === "owned"}
          tabType="owned"
        />
        <VaultSideTabItem
          title="Shared with me"
          icon=""
          onClick={onVaultSideTabItemClick}
          isActive={currentActiveTab === "shared"}
          tabType="shared"
        />
        <VaultSideTabItem
          title="Favorites"
          icon=""
          onClick={onVaultSideTabItemClick}
          isActive={currentActiveTab === "favourites"}
          tabType="favourites"
        />
      </ul>
      <ConnectButton/>
    </div>
  );
};

export default VaultSideTab;
