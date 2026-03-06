#!/usr/bin/env npx tsx
/**
 * Generate an Ed25519 keypair for Mission Control device registration.
 * Run once: npx tsx scripts/generate-device-keypair.ts
 */

import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const pubRaw = publicKey.export({ type: "spki", format: "der" });
const privRaw = privateKey.export({ type: "pkcs8", format: "der" });

const pubB64 = Buffer.from(pubRaw).toString("base64");
const privB64 = Buffer.from(privRaw).toString("base64");

// Ed25519 raw 32-byte keys are at the end of the DER encoding
const pubRaw32 = pubRaw.subarray(-32);
const privRaw32 = privRaw.subarray(-32);

const pubRaw32B64 = Buffer.from(pubRaw32).toString("base64");
const privRaw32B64 = Buffer.from(privRaw32).toString("base64");

console.log("=== Mission Control Device Keypair ===\n");

console.log("Public key (SPKI DER, base64):");
console.log(pubB64);
console.log("\nPublic key (raw 32 bytes, base64):");
console.log(pubRaw32B64);

console.log("\nPrivate key (PKCS8 DER, base64):");
console.log(privB64);
console.log("\nPrivate key (raw 32 bytes, base64):");
console.log(privRaw32B64);

console.log("\n=== Add to .env.local ===\n");
console.log(`OPENCLAW_DEVICE_ID=mission-control`);
console.log(`OPENCLAW_DEVICE_PRIVATE_KEY=${privB64}`);
console.log(`OPENCLAW_DEVICE_PUBLIC_KEY=${pubB64}`);

console.log("\n=== Register on remote server ===\n");
console.log("Provide the raw 32-byte public key (base64) when pairing:");
console.log(pubRaw32B64);
console.log("\nThe exact command depends on your oc CLI version.");
console.log("Example: oc devices pair --id mission-control --pubkey <base64-pubkey>");
