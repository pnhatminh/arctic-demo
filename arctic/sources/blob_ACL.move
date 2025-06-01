module arctic::access_control;
use std::string::String;
use sui::dynamic_field as df;
use arctic::utils::is_prefix;

// ─── Error Codes ─────────────────────────────────────────────────────────────
const ENoAccess: u64 = 0;
const EInvalidCap: u64 = 1;
const EDuplicate: u64 = 1;
const MARKER: u64 = 3;

// ─── Resource Definition ─────────────────────────────────────────────────────
//
//  A single shared object controlling access for exactly one blob.
//  Only the owner can modify its `allowlist`.
//  (Note: `id` MUST be the first field when you declare `has key`.)
public struct AccessControlList has key {
    id: UID,
    service_name: String,
    owner: address,
    allow_list: vector<address>,
}

public struct Cap has key {
    id: UID,
    acl_id: ID,
}

// ─── PUBLIC ENTRY: create_access_control ──────────────────────────────────────
//
//  1) "user" becomes the owner of this ACL.
//  2) `initial` is a vector of addresses that will be inserted (with `true`) into the allowlist.
//  3) At the end, we `share_object(...)` so that ANYONE can read `ac` on‐chain.
public fun create_access_control(
    ctx: &mut TxContext,
    service_name: String,
    allowed_addrs: vector<address>
): Cap {
    let ac = AccessControlList {
        id:         object::new(ctx),
        owner:      ctx.sender(),
        allow_list:  allowed_addrs,
        service_name: service_name,
    };
    let cap = Cap {
        id: object::new(ctx),
        acl_id: object::id(&ac),
    };
    transfer::share_object(ac);
    cap
}

public fun add_access(acl: &mut AccessControlList, cap: &Cap, account: address) {
    assert!(cap.acl_id == object::id(acl), EInvalidCap);
    assert!(!acl.allow_list.contains(&account), EDuplicate);
    acl.allow_list.push_back(account);
}

public fun has_access(acl: &AccessControlList, acl_id: vector<u8>, caller: address): bool {
    let namespace_acl = acl.id.to_bytes();
    if (!is_prefix(namespace_acl, acl_id)) {
        return false
    };

    acl.allow_list.contains(&caller)
}

public fun publish(acl: &mut AccessControlList, cap: &Cap, blob_id: String) {
    assert!(cap.acl_id == object::id(acl), EInvalidCap);
    df::add(&mut acl.id, blob_id, MARKER);
}


entry fun seal_approve(
    acl_id: vector<u8>,
    acl: &AccessControlList,
    ctx: &TxContext,
) {
    assert!(has_access(acl, acl_id, ctx.sender()), ENoAccess);
}