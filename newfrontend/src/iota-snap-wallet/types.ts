import { Transaction, TransactionOptions } from '@iota/sdk';
import {
  IotaSignAndExecuteTransactionInput,
  IotaSignPersonalMessageInput,
  IotaSignTransactionInput,
  WalletAccount,
  WalletIcon,
} from '@iota/wallet-standard';

/**
 * Passing in objects directly to the Snap sometimes doesn't work correctly so we need to serialize to primitive values
 * and then deserialize on the other side.
 */

/* ======== SerializedWalletAccount ======== */

export interface SerializedWalletAccount {
  address: string;
  publicKey: string;
  chains: string[];
  features: string[];
  label?: string;
  icon?: string;
}

export function serializeWalletAccount(
  account: WalletAccount
): SerializedWalletAccount {
  return {
    address: account.address,
    publicKey: Buffer.from(account.publicKey).toString('base64'),
    chains: [...account.chains],
    features: [...account.features],
    label: account.label,
    icon: account.icon,
  };
}

export function deserializeWalletAccount(
  account: SerializedWalletAccount
): WalletAccount {
  return {
    address: account.address,
    publicKey: Buffer.from(account.publicKey, 'base64'),
    chains: account.chains.map((chain) => chain as `${string}:${string}`),
    features: account.features.map(
      (feature) => feature as `${string}:${string}`
    ),
    label: account.label,
    icon: account.icon as WalletIcon,
  };
}

/* ======== SerializedIotaSignMessageInput ======== */

export interface SerializedIotaSignMessageInput {
  message: string;
  account: SerializedWalletAccount;
}

export function serializeIotaSignMessageInput(
  input: IotaSignPersonalMessageInput
): SerializedIotaSignMessageInput {
  return {
    message: Buffer.from(input.message).toString('base64'),
    account: serializeWalletAccount(input.account),
  };
}

/* ======== SerializedIotaSignTransactionInput ======== */

export interface SerializedIotaSignTransactionInput {
  transaction: string;
  account: SerializedWalletAccount;
  chain: string;
}

export function serializeIotaSignTransactionInput(
  input: IotaSignTransactionInput
): SerializedIotaSignTransactionInput {
  return {
    transaction:
      typeof input.transaction === 'string'
        ? input.transaction
        : JSON.stringify(input.transaction),
    account: serializeWalletAccount(input.account),
    chain: input.chain,
  };
}

/* ======== SerializedIotaSignAndExecuteTransactionInput ======== */

export interface SerializedIotaSignAndExecuteTransactionInput {
  transaction: string;
  account: SerializedWalletAccount;
  chain: string;
}

export function serializeIotaSignAndExecuteTransactionInput(
  input: IotaSignAndExecuteTransactionInput
): SerializedIotaSignAndExecuteTransactionInput {
  return {
    transaction:
      typeof input.transaction === 'string'
        ? input.transaction
        : JSON.stringify(input.transaction),
    account: serializeWalletAccount(input.account),
    chain: input.chain,
  };
}

/* ======== StoredState ======== */

export interface StoredState {
  mainnetUrl: string;
  testnetUrl: string;
  devnetUrl: string;
  localnetUrl: string;
}

/* ======== SerializedAdminSetFullnodeUrl ======== */

export interface SerializedAdminSetFullnodeUrl {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  url: string;
}
