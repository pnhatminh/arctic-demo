module arctic::access_control;
use std::string::String;

// ─── Error Codes ─────────────────────────────────────────────────────────────
const ENoAccess: u64 = 1;

// ─── Resource Definition ─────────────────────────────────────────────────────
//
//  A single shared object controlling access for exactly one blob.
//  Only the owner can modify its `allowlist`.
//  (Note: `id` MUST be the first field when you declare `has key`.)
public struct AccessControlList has key {
    id: UID,
    blob_id: String,
    serviceName: String,
    owner: address,
    allowList: vector<address>,
}

public struct Cap has key {
    id: UID,
    aclId: ID,
}

// ─── PUBLIC ENTRY: create_access_control ──────────────────────────────────────
//
//  1) "user" becomes the owner of this ACL.
//  2) `initial` is a vector of addresses that will be inserted (with `true`) into the allowlist.
//  3) At the end, we `share_object(...)` so that ANYONE can read `ac` on‐chain.
public fun create_access_control(
    ctx: &mut TxContext,
    blob_id: String,
    serviceName: String,
    allowed_addrs: vector<address>
): Cap {
    let ac = AccessControlList {
        id:         object::new(ctx),
        blob_id:    blob_id,
        owner:      ctx.sender(),
        allowList:  allowed_addrs,
        serviceName: serviceName,
    };
    let cap = Cap {
        id: object::new(ctx),
        aclId: object::id(&ac),
    };
    transfer::share_object(ac);
    cap
}

public fun has_access(ac: &AccessControlList, blob_id: vector<u8>, caller: address): bool {
    if (ac.blob_id.as_bytes() != blob_id) { 
        return false 
    };
    ac.allowList.contains(&caller)
}

entry fun seal_approve(
    blob_id: vector<u8>,
    ac: &AccessControlList,
    ctx: &TxContext,
) {
    assert!(has_access(ac, blob_id, ctx.sender()), ENoAccess);
}