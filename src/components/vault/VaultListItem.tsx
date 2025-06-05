interface VaultListItemProps {
  cap_id: string;
  acl_id: string;
}
const VaultListItem = ({ cap_id, acl_id }: VaultListItemProps) => {
  return (
    <div>
      <span>
        ID {cap_id} ACL ID {acl_id}
      </span>
    </div>
  );
};

export default VaultListItem;
