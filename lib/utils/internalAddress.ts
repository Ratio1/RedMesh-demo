import { getAddress, keccak256, hexToBytes, bytesToHex } from 'viem';
import { Point } from '@noble/secp256k1';

const INTERNAL_ADDRESS_PREFIX = '0xai_';

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(padded, 'base64'));
  }

  throw new Error('No base64 decoder available in this environment.');
};

export const internalNodeAddressToEthAddress = (address: string): `0x${string}` => {
  const raw = address.startsWith(INTERNAL_ADDRESS_PREFIX) ? address.slice(INTERNAL_ADDRESS_PREFIX.length) : address;

  if (!raw) {
    throw new Error('Internal node address is empty.');
  }

  if (raw.length !== 44 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new Error('Internal node address is not in the expected format.');
  }

  let compressed: Uint8Array;
  try {
    compressed = base64UrlToBytes(raw); // 33-byte compressed pk
  } catch (error) {
    throw new Error(`Unable to decode internal node address: ${(error as Error).message}`);
  }

  if (compressed.length !== 33) {
    throw new Error('Internal node address decodes to an invalid public key.');
  }

  let uncompressed: Uint8Array;
  try {
    // noble exposes toRawBytes in newer builds; fallback to toBytes for compatibility.
    const point = Point.fromHex(bytesToHex(compressed));
    uncompressed =
      typeof (point as any).toRawBytes === 'function'
        ? (point as any).toRawBytes(false)
        : point.toBytes(false); // 65 bytes, 0x04 + X + Y
  } catch (error) {
    throw new Error(`Invalid compressed public key for internal node address: ${(error as Error).message}`);
  }

  const pubkey = uncompressed.slice(1); // drop 0x04
  const hash = keccak256(pubkey);
  const ethBytes = hexToBytes(hash).slice(-20);
  return getAddress(bytesToHex(ethBytes));
};
