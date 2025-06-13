import { useCredentialsStore } from "@/store/useCredentialsStore";
import { type CredentialsModalType } from "@/types/CredentialsModalType";
import { useSuiClient } from "@mysten/dapp-kit";
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import UpdateCredentialsTab from "./UpdateCredentialsTab";
import UpdatePermissionTab from "./UpdatePermissionTab";
import ViewCredentialsTab from "./ViewCredentialsTab";

interface CredentialsModalProps {
  type: CredentialsModalType;
  setType: Dispatch<SetStateAction<CredentialsModalType>>;
  isOpen: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const CredentialsModal = ({
  type,
  setType,
  isOpen,
  setOpen,
}: CredentialsModalProps) => {
  const suiClient = useSuiClient();
  const [isLoadingObject, setIsLoadingObject] = useState(false);
  const { credentials_id, credentials_name, setCredentials } =
    useCredentialsStore();

  const getCredentialsObject = useCallback(async () => {
    setIsLoadingObject(true);
    const credentialsObjectRaw = await suiClient.getObject({
      id: credentials_id!,
      options: { showContent: true },
    });
    const encryptedObjects = await suiClient
      .getDynamicFields({
        parentId: credentials_id!,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: { data: any[] }) =>
        res.data
          .sort((x, y) => parseInt(y.version) - parseInt(x.version))
          .map((obj) => obj.name.value as string),
      );

    const fields =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (credentialsObjectRaw.data?.content as { fields: any })?.fields || {};

    const credentialsObject = {
      id: fields?.id,
      service_name: fields?.service_name,
      allow_list: fields.allow_list,
      blob_id: encryptedObjects[0],
    };
    setCredentials(credentialsObject);
    setIsLoadingObject(false);
  }, [credentials_id, setCredentials, suiClient]);

  useEffect(() => {
    getCredentialsObject();
  }, [credentials_id, getCredentialsObject, suiClient]);

  const tabContent = (
    <>
      <TabsContent value="view">
        <ViewCredentialsTab />
      </TabsContent>
      <TabsContent value="edit">
        <UpdateCredentialsTab reloadCredentials={getCredentialsObject} />
      </TabsContent>
      <TabsContent value="edit_permission">
        <UpdatePermissionTab />
      </TabsContent>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{credentials_name}</DialogTitle>
        <Tabs
          defaultValue={type}
          onValueChange={(value) => setType(value as CredentialsModalType)}
        >
          <TabsList>
            <TabsTrigger value="view">View credentials</TabsTrigger>
            <TabsTrigger value="edit">Edit credentials</TabsTrigger>
            <TabsTrigger value="edit_permission">Edit permission</TabsTrigger>
          </TabsList>
          {isLoadingObject ? <span>Loading...</span> : tabContent}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
export default CredentialsModal;
