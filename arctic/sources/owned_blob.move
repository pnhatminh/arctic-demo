address 0x5591251e041522a703dc43bd5d9935cccb7bd76482553abe4c71bc4e863c4605 {
module owned_blob {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::vector;

    /// An “owned” object that records:
    ///   • `blob_id`         – the Walrus blob identifier (as bytes).
    ///   • `shared_blob_id`  – the unique object ID (Address) of a corresponding SharedBlob.
    ///   • `owner`           – the Move‐caller who created this OwnedBlob.
    ///
    /// By storing `shared_blob_id: address`, we capture the SharedBlob’s UID (its object ID)
    /// without consuming the SharedBlob itself.
    struct OwnedBlob has key, store {
        id: UID,
        blob_id: vector<u8>,
        owner: address,
        shared_blob_id: address,
    }

    /// Error code
    const E_NOT_OWNER: u64 = 1;

    /// Create a new `OwnedBlob`.  The signer becomes `owner`.
    ///
    /// Params:
    ///   • `blob_id`        – Walrus blob ID as `vector<u8>`.
    ///   • `shared_blob_id` – `address` of an existing SharedBlob object (its UID).
    ///
    /// This does NOT consume or burn the SharedBlob; it merely stores its object‐ID.
    entry fun create(
        ctx: &mut TxContext,
        blob_id: vector<u8>,
        shared_blob_id: address
    ): OwnedBlob {
        let tx_signer = TxContext::sender(ctx);
        OwnedBlob {
            id: UID::new(ctx),
            blob_id,
            owner: tx_signer,
            shared_blob_id,
        }
    }

    /// Delete (burn) this `OwnedBlob`.  Only its `owner` may invoke.
    entry fun delete(blob_obj: OwnedBlob) {
        let owner = blob_obj.owner;
        let caller = TxContext::sender(&blob_obj.id);
        assert!(caller == owner, E_NOT_OWNER);
        // By taking `blob_obj` by value, Sui will burn it here.
    }
}
}
