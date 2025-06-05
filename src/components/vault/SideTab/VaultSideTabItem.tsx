import clsx from "classnames";
import type { Tabs } from "./VaultSideTab";

interface VaultSideTabItemProps {
  title: string;
  icon: string;
  isActive: boolean;
  onClick: (tab: Tabs) => void;
  tabType: Tabs;
}
const VaultSideTabItem = ({
  title,
  icon,
  isActive,
  tabType,
  onClick,
}: VaultSideTabItemProps) => {
  return (
    <li
      onClick={() => onClick(tabType)}
      className={clsx(isActive && "bg-primary", "h-8 w-80 cursor-pointer")}
    >
      <img src={icon} />
      <span>{title}</span>
    </li>
  );
};

export default VaultSideTabItem;
