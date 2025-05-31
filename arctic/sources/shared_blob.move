address 0xArctic {
module shared_blob {
    use sui::object::{Self, UID};
    use sui::table::{Table, new, contains, borrow, add, remove};
    use sui::vector;
    use sui::tx_context::TxContext;
    use 0xWalrusSeal::seal::{seal_approve, seal_revoke};

    enum Permission has copy, drop, store {
        ReadOnly,
        ReadWrite,
    }

    const E_NOT_READ_WRITE:      u64 = 1;
    const E_NOT_IN_ALLOWLIST:    u64 = 2;
    const E_ALREADY_EXISTS:      u64 = 3;
    const E_NOT_EXISTS:          u64 = 4;
    const E_INVALID_PERMISSION:  u64 = 5;
    const E_NOT_OWNER:           u64 = 6;

    struct SharedBlob has key, store, shared {
        id: UID,
        blob_id: vector<u8>,
        metadata: vector<u8>,
        owner: address,
        allowlist: Table<address, Permission>,
    }

    entry fun create(
        ctx: &mut TxContext,
        blob_id: vector<u8>,
        metadata: vector<u8>,
        initial_read_only: vector<address>,
    ): SharedBlob {
        let tx_signer = TxContext::sender(ctx);

        let mut tbl = new<address, Permission>(ctx);

        add(&mut tbl, tx_signer, Permission::ReadWrite);
        seal_approve(&blob_id, tx_signer, Permission::ReadWrite);

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

        object::new_shared<SharedBlob>(SharedBlob {
            id: UID::new(ctx),
            blob_id,
            metadata,
            owner: tx_signer,
            allowlist: tbl,
        })
    }

    fun assert_read_write(allowlist: &Table<address, Permission>, caller: address) {
        assert!(contains(allowlist, &caller), E_NOT_IN_ALLOWLIST);
        let perm_ref = borrow(allowlist, &caller);
        match *perm_ref {
            Permission::ReadWrite => (), 
            _ => abort E_NOT_READ_WRITE,
        }
    }

    entry fun add_user(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        addr_to_add: address,
        permission: Permission
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        assert!(!contains(&shared_obj.allowlist, &addr_to_add), E_ALREADY_EXISTS);

        add(&mut shared_obj.allowlist, addr_to_add, permission);
        seal_approve(&shared_obj.blob_id, addr_to_add, permission);
    }

    entry fun remove_user(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        addr_to_remove: address
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        assert!(contains(&shared_obj.allowlist, &addr_to_remove), E_NOT_EXISTS);

        remove(&mut shared_obj.allowlist, &addr_to_remove);
        seal_revoke(&shared_obj.blob_id, addr_to_remove);
    }

    entry fun modify_permission(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        addr_to_modify: address,
        new_permission: Permission
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        assert!(contains(&shared_obj.allowlist, &addr_to_modify), E_NOT_EXISTS);

        remove(&mut shared_obj.allowlist, &addr_to_modify);
        seal_revoke(&shared_obj.blob_id, addr_to_modify);

        add(&mut shared_obj.allowlist, addr_to_modify, new_permission);
        seal_approve(&shared_obj.blob_id, addr_to_modify, new_permission);
    }

    entry fun update_metadata(
        ctx: &mut TxContext,
        shared_obj: &mut SharedBlob,
        new_metadata: vector<u8>
    ) {
        let caller = TxContext::sender(&shared_obj.id);
        assert_read_write(&shared_obj.allowlist, caller);

        shared_obj.metadata = new_metadata;
    }

    entry fun delete_blob(
        shared_obj: SharedBlob
    ) {
        let owner = shared_obj.owner;
        let caller = TxContext::sender(&shared_obj.id);
        assert!(caller == owner, E_NOT_OWNER);

    }

    public fun view_blob(
        shared_obj: &SharedBlob,
        querier: address
    ): (vector<u8>, vector<u8>) {
        assert!(contains(&shared_obj.allowlist, &querier), E_NOT_IN_ALLOWLIST);
        (shared_obj.blob_id.clone(), shared_obj.metadata.clone())
    }

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
