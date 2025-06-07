interface VaultListItemProps {
  cap_id: string;
  shared_credentials_id: string;
  service_name: string;
}
const VaultListItem = ({
  cap_id,
  shared_credentials_id,
  service_name,
}: VaultListItemProps) => {
  return (
    <div>
      <span>
        ID {cap_id} Credentials ID {shared_credentials_id} Service Name{" "}
        {service_name}
      </span>
    </div>
  );
};

export default VaultListItem;
