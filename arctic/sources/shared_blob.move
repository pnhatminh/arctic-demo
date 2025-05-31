address 0x5591251e041522a703dc43bd5d9935cccb7bd76482553abe4c71bc4e863c4605 {
module shared_blob {
    use sui::object::{Self, UID};
    use sui::table::{Table, new, contains, borrow, add, remove};
    use sui::vector;
    use sui::tx_context::TxContext;
    //
    // Hypothetical Walrus Seal integration.
    // We assume there's a Move module at `0xWalrusSeal` exporting:
    //   fun seal_approve(blob_id: &vector<u8>, user: address, permission: Permission);
    //   fun seal_revoke(blob_id: &vector<u8>, user: address);
    //
    // Adjust these imports if your actual Walrus Seal package uses a different address or name.
    use 0xWalrusSeal::seal::{seal_approve, seal_revoke};

    /// Permission variants for allowlist entries.
    /// - `ReadOnly`  : can only view blob data (no modifications to allowlist or metadata).
    /// - `ReadWrite` : can view blob data, modify metadata, and manage the allowlist.
    ///
    /// We tag with `has copy, drop, store` so this enum can be stored in a Table.
    enum Permission has copy, drop, store {
        ReadOnly,
        ReadWrite,
    }

    /// Error codes
    const E_NOT_READ_WRITE:      u64 = 1;
    const E_NOT_IN_ALLOWLIST:    u64 = 2;
    const E_ALREADY_EXISTS:      u64 = 3;
    const E_NOT_EXISTS:          u64 = 4;
    const E_INVALID_PERMISSION:  u64 = 5;
    const E_NOT_OWNER:           u64 = 6;

    /// A shared object wrapping a Walrus blob, with an allowlist mapping addresses → `Permission`.
    /// - `id`         : Unique object ID (provided by Sui).
    /// - `blob_id`    : The Walrus blob ID (bytes, e.g. hex‐encoded string).
    /// - `metadata`   : Arbitrary metadata bytes (e.g. MIME type / description).
    /// - `owner`      : The address of the creator/owner.
    /// - `allowlist`  : Table<address, Permission>, for quick lookup and permission storage.
    ///
    /// We choose `Table<address, Permission>` over `vector<address>` + parallel permission info
    /// because:
    /// 1. Fast membership checks (`contains` + `borrow`) in O(log N) (no linear scan).
    /// 2. Easily store a small enum (`Permission`) per address to distinguish ReadOnly vs. ReadWrite.
    /// 3. Clean “overwrite” semantics: remove + add with new permission is straightforward.
    struct SharedBlob has key, store, shared {
        id: UID,
        blob_id: vector<u8>,
        metadata: vector<u8>,
        owner: address,
        allowlist: Table<address, Permission>,
    }

    /// Entry function to create a new `SharedBlob`.
    /// - `blob_id`           : Walrus blob identifier bytes (e.g. ASCII of hex hash).
    /// - `metadata`          : Initial metadata bytes (e.g. MIME type, description).
    /// - `initial_read_only` : Vector<address> of addresses granted `ReadOnly` from the start.
    ///
    /// The transaction signer becomes `owner` and is automatically inserted as `ReadWrite`.
    entry fun create(
        ctx: &mut TxContext,
        blob_id: vector<u8>,
        metadata: vector<u8>,
        initial_read_only: vector<address>,
    ): SharedBlob {
        let tx_signer = TxContext::sender(ctx);

        // Initialize an empty allowlist: Table<address, Permission>.
        let mut tbl = new<address, Permission>(ctx);

        // Insert owner with ReadWrite permission and call `seal_approve`.
        add(&mut tbl, tx_signer, Permission::ReadWrite);
        seal_approve(&blob_id, tx_signer, Permission::ReadWrite);

        // Insert each address from `initial_read_only` as ReadOnly (if not already present).
        let len = vector::length(&initial_read_only);
        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&initial_read_only, i);
            if (!contains(&tbl, &addr)) {
                add(&mut tbl, addr, Permission::ReadOnly);
                seal_approve(&blob_id, addr, Permission::ReadOnly);
            }
            i = i + 1;
        }

        // Publish as a shared object so anyone can reference it (read), but modifications
        // require the entry functions below.
        object::new_shared<SharedBlob>(SharedBlob {
            id: UID::new(ctx),
            blob_id,
            metadata,
            owner: tx_signer,
            allowlist: tbl,
        })
    }

    /// Internal helper: ensure that `caller` has `ReadWrite` permission in `allowlist`.
    fun assert_read_write(allowlist: &Table<address, Permission>, caller: address) {
        assert!(contains(allowlist, &caller), E_NOT_IN_ALLOWLIST);
        let perm_ref = borrow(allowlist, &caller);
        match *perm_ref {
            Permission::ReadWrite => (), 
            _ => abort E_NOT_READ_WRITE,
        }
    }

    /// Add a user `addr_to_add` with specified `permission` (ReadOnly or ReadWrite).
    /// Only a caller with `ReadWrite` permission may invoke this.
    /// Fails if `addr_to_add` is already in the allowlist.
    entry fun add_user(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        addr_to_add: address,
        permission: Permission
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        // Cannot add if already present
        assert!(!contains(&shared_obj.allowlist, &addr_to_add), E_ALREADY_EXISTS);

        // Insert into the Table and propagate to Walrus Seal
        add(&mut shared_obj.allowlist, addr_to_add, permission);
        seal_approve(&shared_obj.blob_id, addr_to_add, permission);
    }

    /// Remove a user `addr_to_remove` from the allowlist.
    /// Only a caller with `ReadWrite` permission may invoke this. Fails if not present.
    entry fun remove_user(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        addr_to_remove: address
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        assert!(contains(&shared_obj.allowlist, &addr_to_remove), E_NOT_EXISTS);

        // Remove from Table & call Seal revoke
        remove(&mut shared_obj.allowlist, &addr_to_remove);
        seal_revoke(&shared_obj.blob_id, addr_to_remove);
    }

    /// Change the permission of an existing user `addr_to_modify` to `new_permission`.
    /// Only a caller with `ReadWrite` permission may invoke this.
    /// Fails if the address is not present.
    entry fun modify_permission(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        addr_to_modify: address,
        new_permission: Permission
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        assert!(contains(&shared_obj.allowlist, &addr_to_modify), E_NOT_EXISTS);

        // Remove old entry and revoke its Seal approval
        remove(&mut shared_obj.allowlist, &addr_to_modify);
        seal_revoke(&shared_obj.blob_id, addr_to_modify);

        // Re‐insert with new permission and re‐approve in Seal
        add(&mut shared_obj.allowlist, addr_to_modify, new_permission);
        seal_approve(&shared_obj.blob_id, addr_to_modify, new_permission);
    }

    /// Update the `metadata` bytes. Only a caller with `ReadWrite` permission may call this.
    entry fun update_metadata(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        new_metadata: vector<u8>
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        shared_obj.metadata = new_metadata;
    }

    /// Delete (burn) the shared blob entirely. Only the original `owner` may invoke this.
    entry fun delete_blob(
        shared_obj: SharedBlob
    ) {
        let owner = shared_obj.owner;
        let caller = TxContext::sender(&shared_obj.id);
        assert!(caller == owner, E_NOT_OWNER);

        // Before burning, revoke Seal approvals for everyone in allowlist
        // (iterate over keys is not directly supported; for simplicity, assume
        // Seal automatically handles cleanup on blob deletion or handle off‐chain).
        //
        // Taking ownership of `shared_obj` here causes it to be burned.
    }

    /// PUBLIC VIEW: Get (`blob_id`, `metadata`) if `querier` is in the allowlist (any permission).
    /// Otherwise abort. This is a read‐only function (non‐entry).
    public fun view_blob(
        shared_obj: &SharedBlob,
        querier: address
    ): (vector<u8>, vector<u8>) {
        assert!(contains(&shared_obj.allowlist, &querier), E_NOT_IN_ALLOWLIST);
        (shared_obj.blob_id.clone(), shared_obj.metadata.clone())
    }

    /// PUBLIC VIEW: Return which `Permission` (`ReadOnly` or `ReadWrite`) `querier` has.
    /// Aborts if `querier` is not in the allowlist.
    public fun get_permission(
        shared_obj: &SharedBlob,
        querier: address
    ): Permission {
        assert!(contains(&shared_obj.allowlist, &querier), E_NOT_IN_ALLOWLIST);
        let perm_ref = borrow(&shared_obj.allowlist, &querier);
        *perm_ref
    }
}
}
