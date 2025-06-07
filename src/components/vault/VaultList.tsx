import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useCallback, useEffect, useState } from "react";
import type { Cap } from "../../types/Cap";
import AddNewCredentials from "./AddNewCredentials";
import { usePackageInfo } from "@/hooks/usePackageInfo";
import { Toaster } from "@/components/ui/sonner";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";

type SearchByType = "id" | "name";

const VaultList = () => {
  const currentAccount = useCurrentAccount();
  const [isLoadingVaultList, setIsLoadingVaultList] = useState(false);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [searchBy, setSearchBy] = useState<SearchByType>("id");
  const suiClient = useSuiClient();
  const { packageId, packageName } = usePackageInfo();

  const getCapObj = useCallback(async () => {
    if (!currentAccount?.address) return;
    setIsLoadingVaultList(true);
    const res = await suiClient.getOwnedObjects({
      owner: currentAccount?.address,
      options: {
        showContent: true,
        showType: true,
      },
      filter: {
        StructType: `${packageId}::${packageName}::Cap`,
      },
    });
    console.log(res.data);
    const caps = res.data
      .map((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = (obj!.data!.content as { fields: any }).fields;
        return {
          id: fields?.id.id,
          shared_credentials_id: fields?.shared_credentials_id,
          service_name: fields?.service_name,
        };
      })
      .filter((item) => item !== null) as unknown as Cap[];
    setCaps(caps);
    setIsLoadingVaultList(false);
  }, [currentAccount?.address, packageId, packageName, suiClient]);

  const vaultColumns: ColumnDef<Cap>[] = [
    {
      accessorKey: "id",
      header: () => <div className="text-start">ID</div>,
      cell: ({ row }) => {
        return (
          <div className="text-start font-medium">
            {(row.getValue("id") as string).slice(0, 6)}
          </div>
        );
      },
    },
    {
      accessorKey: "service_name",
      header: () => <div className="text-start">Service Name</div>,
      cell: ({ row }) => {
        return (
          <div className="text-start font-medium">
            {row.getValue("service_name")}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const payment = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default">
                <span className="">Action</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(payment.id)}
              >
                View credentials
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Update credentials</DropdownMenuItem>
              <DropdownMenuItem>Add permission</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  useEffect(() => {
    getCapObj();
  }, [getCapObj]);

  useEffect(() => {
    console.log(caps);
  }, [caps]);

  return (
    <div className="flex flex-col w-full gap-4">
      <Toaster />
      <h1>Welcome to your Igloo {currentAccount?.address.slice(0, 6)}</h1>
      <div className="flex flex-row w-full justify-between">
        <div className="flex flex-col gap-4 w-1/2">
          <Input placeholder="Search" />
          <RadioGroup
            defaultValue={searchBy}
            onValueChange={(value) => setSearchBy(value as SearchByType)}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem className="p-0" value="id" id="r1" />
              <Label htmlFor="r1">sesarch by ID</Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="name" id="r2" />
              <Label htmlFor="r2">sesarch by Name</Label>
            </div>
          </RadioGroup>
        </div>
        <AddNewCredentials getCapObj={getCapObj} />
      </div>
      {isLoadingVaultList && <h2>Loading vault...</h2>}
      {!isLoadingVaultList &&
        (caps.length ? (
          <DataTable columns={vaultColumns} data={caps} />
        ) : (
          <p>There is no credentials stored in your Igloo. Create a new one</p>
        ))}
    </div>
  );
};

export default VaultList;
