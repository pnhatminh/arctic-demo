module arctic::credentials;
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
    shared_credentials_id: ID,
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

    let shared_credential = SharedCredential {
        id:         object::new(ctx),
        allow_list:  allow_list,
        service_name: service_name,
    };

    let cap = Cap {
        id: object::new(ctx),
        shared_credentials_id: object::id(&shared_credential),
        service_name: service_name,
        owner:      ctx.sender(),
    };
    transfer::share_object(shared_credential);
    transfer::transfer(cap, ctx.sender());
}

public fun add_access(shared_credential: &mut SharedCredential, cap: &Cap, new_accessible_account: address, permission: AccessType, ctx: &mut TxContext) {
    let allow_list = &shared_credential.allow_list;
    let sender_access = table::borrow(allow_list, ctx.sender());

    assert!(cap.shared_credentials_id == object::id(shared_credential), EInvalidCap);
    assert!(sender_access == AccessType::ReadWrite || sender_access == AccessType::Owner, ENotAuthorized);
    assert!(!shared_credential.allow_list.contains(new_accessible_account), EDuplicate);

    table::add(&mut shared_credential.allow_list, new_accessible_account, permission);
    let newCap = Cap {
        id: object::new(ctx),
        shared_credentials_id: object::id(shared_credential),
        service_name: cap.service_name,
        owner:      ctx.sender(),
    };
    transfer::transfer(newCap, new_accessible_account);
}

public fun namespace(shared_credential: &SharedCredential): vector<u8> {
    shared_credential.id.to_bytes()
}

public fun has_access(shared_credential: &SharedCredential, shared_credentials_id: vector<u8>, caller: address): bool {
    let namespace = namespace(shared_credential);
    if (!is_prefix(namespace, shared_credentials_id)) {
        return false
    };

    shared_credential.allow_list.contains(caller)
}

public fun publish_blob_id(shared_credential: &mut SharedCredential, cap: &Cap, blob_id: String, ctx: &mut TxContext) {
    let allow_list = &shared_credential.allow_list;
    let sender_access = table::borrow(allow_list, ctx.sender());

    assert!(cap.shared_credentials_id == object::id(shared_credential), EInvalidCap);
    assert!(sender_access == AccessType::ReadWrite || sender_access == AccessType::Owner, ENotAuthorized);

    df::add(&mut shared_credential.id, blob_id, MARKER);
}

entry fun seal_approve(
    shared_credentials_id: vector<u8>,
    shared_credentials: &SharedCredential,
    ctx: &TxContext,
) {
    assert!(has_access(shared_credentials, shared_credentials_id, ctx.sender()), ENoAccess);
}
