import { useCredentialsStore } from "@/store/useCredentialsStore";

const ViewCredentialsTab = () => {
  const { credentials } = useCredentialsStore();
  if (!credentials) return <span>Invalid Credentials object</span>;
  return (
    <>
      {credentials.blob_id ? (
        <span>${credentials.blob_id}</span>
      ) : (
        <span>There is no credentials yet. Please update it here.</span>
      )}
    </>
  );
};

export default ViewCredentialsTab;
