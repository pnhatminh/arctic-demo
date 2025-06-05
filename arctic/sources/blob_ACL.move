module arctic::access_control;
use std::string::String;
use sui::dynamic_field as df;
use sui::table;
use arctic::utils::is_prefix;

// ─── Error Codes ─────────────────────────────────────────────────────────────
const ENoAccess: u64 = 0;
const EInvalidCap: u64 = 1;
const EDuplicate: u64 = 2;
const EAccessRevoked: u64 = 3;
const ENotAuthorized: u64 = 4;
const MARKER: u64 = 4;

// ─── Enums ─────────────────────────────────────────────────────────────
public enum AccessType has copy, drop, store {
    Owner,
    Read,
    ReadWrite,
}

// ─── Resource Definition ─────────────────────────────────────────────────────
//
//  A single shared object controlling access for exactly one blob.
//  Only the owner can modify its `allowlist`.
//  (Note: `id` MUST be the first field when you declare `has key`.)
public struct SharedCredential has key {
    id: UID,
    service_name: String,
    allow_list: sui::table::Table<address, AccessType>,
}

public struct Cap has key {
    id: UID,
    acl_id: ID,
    owner: address,
    service_name: String,
}

// ─── PUBLIC ENTRY: create_credentials ──────────────────────────────────────
//
//  1) "user" becomes the owner of this ACL.
//  2) `initial` is a vector of addresses that will be inserted (with `true`) into the allowlist.
//  3) At the end, we `share_object(...)` so that ANYONE can read `ac` on‐chain.
public fun create_credentials(
    service_name: String,
    ctx: &mut TxContext,
) {
    let mut allow_list = table::new<address, AccessType>(ctx);
    table::add(&mut allow_list, ctx.sender(), AccessType::Owner);

    let sharedCredential = SharedCredential {
        id:         object::new(ctx),
        allow_list:  allow_list,
        service_name: service_name,
    };

    let cap = Cap {
        id: object::new(ctx),
        acl_id: object::id(&sharedCredential),
        service_name: service_name,
        owner:      ctx.sender(),
    };
    transfer::share_object(sharedCredential);
    transfer::transfer(cap, ctx.sender());
}

public fun add_access(sharedCredential: &mut SharedCredential, cap: &Cap, newAccessibleAccount: address, permission: AccessType, ctx: &mut TxContext) {
    let allow_list = &sharedCredential.allow_list;
    let sender_access = table::borrow(allow_list, ctx.sender());

    assert!(cap.acl_id == object::id(sharedCredential), EInvalidCap);
    assert!(sender_access == AccessType::ReadWrite || sender_access == AccessType::Owner, ENotAuthorized);
    assert!(!sharedCredential.allow_list.contains(newAccessibleAccount), EDuplicate);

    table::add(&mut sharedCredential.allow_list, newAccessibleAccount, permission);
    let newCap = Cap {
        id: object::new(ctx),
        acl_id: object::id(sharedCredential),
        service_name: cap.service_name,
        owner:      ctx.sender(),
    };
    transfer::transfer(newCap, newAccessibleAccount);
}

public fun namespace(sharedCredential: &SharedCredential): vector<u8> {
    sharedCredential.id.to_bytes()
}

public fun has_access(sharedCredential: &SharedCredential, acl_id: vector<u8>, caller: address): bool {
    let namespace = namespace(sharedCredential);
    if (!is_prefix(namespace, acl_id)) {
        return false
    };

    sharedCredential.allow_list.contains(caller)
}

public fun publish_blob_id(sharedCredential: &mut SharedCredential, cap: &Cap, blob_id: String, ctx: &mut TxContext) {
    let allow_list = &sharedCredential.allow_list;
    let sender_access = table::borrow(allow_list, ctx.sender());

    assert!(cap.acl_id == object::id(sharedCredential), EInvalidCap);
    assert!(sender_access == AccessType::ReadWrite || sender_access == AccessType::Owner, ENotAuthorized);

    df::add(&mut sharedCredential.id, blob_id, MARKER);
}

entry fun seal_approve(
    acl_id: vector<u8>,
    acl: &SharedCredential,
    ctx: &TxContext,
) {
    assert!(has_access(acl, acl_id, ctx.sender()), ENoAccess);
}