import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { toast } from "sonner";
import { usePackageInfo } from "@/hooks/usePackageInfo";

interface AddNewCredentialsProps {
  getCapObj: () => void;
}

const AddNewCredentials = ({ getCapObj }: AddNewCredentialsProps) => {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });
  const [serviceName, setServiceName] = useState<string>("");
  const [errors, setErrors] = useState<string>();
  const { packageId, packageName } = usePackageInfo();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const onSubmit = () => {
    const tx = new Transaction();
    setIsLoading(true);
    tx.moveCall({
      target: `${packageId}::${packageName}::create_credentials`,
      arguments: [tx.pure.string(serviceName)],
    });
    tx.setGasBudget(10000000);
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log("res", result);
          // Extract the created allowlist object ID from the transaction result
          const credentialsObjects = result.effects?.created?.find(
            (item) =>
              item.owner &&
              typeof item.owner === "object" &&
              "Shared" in item.owner,
          );
          const createdObjectId = credentialsObjects?.reference?.objectId;
          if (createdObjectId) {
            setIsLoading(false);
            setIsOpen(false);
            toast("The credentials has been created.");
            getCapObj();
          }
        },
        onError: async (error) => {
          console.error(error);
          setErrors(
            "Problem when creating a new credentials. Please try again",
          );
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Add new credentials</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add new credentials</DialogTitle>
          <DialogDescription>
            Add a new credentials to the Igloo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="name-1">Name</Label>
            <Input
              id="name-1"
              name="name"
              placeholder="Netflix"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={onSubmit} disabled={isLoading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddNewCredentials;
