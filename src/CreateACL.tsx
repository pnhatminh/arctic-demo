import type { SuiClient } from "@mysten/sui/client";
import { usePackageId } from "./hooks/usePackageId";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Button, Card, Flex, Spinner } from "@radix-ui/themes";

interface CreateACLProps {
  suiClient: SuiClient;
  setFinishedAddACL: Dispatch<SetStateAction<boolean>>;
}

const CreateACL = ({ suiClient, setFinishedAddACL }: CreateACLProps) => {
  const packageId = usePackageId();
  const [serviceName, setServiceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  function createAllowlist(service_name: string) {
    setIsCreating(true);
    setSucceeded(false);
    if (service_name === "") {
      alert("Please enter a name for the allowlist");
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::access_control::create_access_control`,
      arguments: [tx.pure.string(service_name)],
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
          const aclObject = result.effects?.created?.find(
            (item) =>
              item.owner &&
              typeof item.owner === "object" &&
              "Shared" in item.owner
          );
          const createdObjectId = aclObject?.reference?.objectId;
          if (createdObjectId) {
            setSucceeded(true);
            window.open(
              `${window.location.origin}/allowlist-example/admin/allowlist/${createdObjectId}`,
              "_blank"
            );
          } else {
            setError("Failed to create allowlist: No object ID returned.");
          }
        },
        onError: (err) => {
          console.error("Error creating allowlist:", err);
          setError(
            `An error occurred while creating the allowlist: ${err.message}`
          );
        },
        onSettled: () => {
          setIsCreating(false);
          setFinishedAddACL(true);
        },
      }
    );
  }
  return (
    <Card>
      <Flex direction="row" gap="2" justify="start">
        <input
          placeholder="Allowlist Name"
          onChange={(e) => setServiceName(e.target.value)}
        />
        <Button
          size="3"
          onClick={() => {
            createAllowlist(serviceName);
          }}
        >
          Create Allowlist
        </Button>
        {isCreating && <Spinner size="3" />}
        {succeeded && <span>Allowlist created successfully!</span>}
        {error && <span style={{ color: "red" }}>{error}</span>}
      </Flex>
    </Card>
  );
};

export default CreateACL;
