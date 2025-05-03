import {
  ReadonlyWalletAccount,
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  IotaFeatures,
  IotaSignAndExecuteTransactionMethod,
  IotaSignAndExecuteTransactionOutput,
  IotaSignPersonalMessageInput,
  IotaSignPersonalMessageMethod,
  IotaSignPersonalMessageOutput,
  IotaSignTransactionInput,
  IotaSignTransactionMethod,
  IotaSignTransactionOutput,
  Wallet,
  WalletAccount,
  getWallets,
} from '@iota/wallet-standard';
import { ICON } from './icon';
import { MetaMaskInpageProvider } from '@metamask/providers';
type BaseProvider = MetaMaskInpageProvider;
import detectEthereumProvider from '@metamask/detect-provider';
import {
  SerializedAdminSetFullnodeUrl,
  SerializedWalletAccount,
  StoredState,
  deserializeWalletAccount,
  serializeIotaSignAndExecuteTransactionInput,
  serializeIotaSignMessageInput,
  serializeIotaSignTransactionInput,
} from './types';
import { convertError } from './errors';

export * from './types';
export * from './errors';

export const SNAP_ORIGIN = 'npm:@3mate/iota-metamask-snap';
export const SNAP_VERSION = '^0.0.1';

export const IOTA_CHAINS = [
  'iota:mainnet',
  'iota:testnet',
  'iota:devnet',
] as const;

export function registerIotaSnapWallet(): Wallet {
  const wallets = getWallets();
  for (const wallet of wallets.get()) {
    if (wallet.name === IotaSnapWallet.NAME) {
      console.warn('IotaSnapWallet already registered');
      return wallet;
    }
  }

  const wallet = new IotaSnapWallet();
  wallets.register(wallet as unknown as Wallet);
  return wallet;
}

export async function getAccounts(
  provider: BaseProvider
): Promise<ReadonlyWalletAccount[]> {
  const res = (await provider.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: SNAP_ORIGIN,
      request: {
        method: 'getAccounts',
      },
    },
  })) as [SerializedWalletAccount];

  return res.map(
    (acc) => new ReadonlyWalletAccount(deserializeWalletAccount(acc))
  );
}

export async function admin_getStoredState(provider: BaseProvider) {
  const res = (await provider.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: SNAP_ORIGIN,
      request: {
        method: 'admin_getStoredState',
      },
    },
  })) as StoredState;

  return res;
}

export async function admin_setFullnodeUrl(
  provider: BaseProvider,
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet',
  url: string
) {
  const params: SerializedAdminSetFullnodeUrl = {
    network,
    url,
  };
  await provider.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: SNAP_ORIGIN,
      request: {
        method: 'admin_setFullnodeUrl',
        params: JSON.parse(JSON.stringify(params)),
      },
    },
  });
}

export async function signPersonalMessage(
  provider: BaseProvider,
  messageInput: IotaSignPersonalMessageInput
): Promise<IotaSignPersonalMessageOutput> {
  const serialized = serializeIotaSignMessageInput(messageInput);

  try {
    return (await provider.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: SNAP_ORIGIN,
        request: {
          method: 'signPersonalMessage',
          params: JSON.parse(JSON.stringify(serialized)),
        },
      },
    })) as IotaSignPersonalMessageOutput;
  } catch (e) {
    throw convertError(e);
  }
}

export async function signMessage(
  provider: BaseProvider,
  messageInput: IotaSignPersonalMessageInput
): Promise<IotaSignPersonalMessageOutput> {
  const res = await signPersonalMessage(provider, messageInput);

  return {
    bytes: res.bytes,
    signature: res.signature,
  };
}

export async function signTransactionBlock(
  provider: BaseProvider,
  transactionInput: IotaSignTransactionInput
): Promise<IotaSignTransactionOutput> {
  const serialized = serializeIotaSignTransactionInput(transactionInput);

  try {
    return (await provider.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: SNAP_ORIGIN,
        request: {
          method: 'signTransactionBlock',
          params: JSON.parse(JSON.stringify(serialized)),
        },
      },
    })) as IotaSignTransactionOutput;
  } catch (e) {
    throw convertError(e);
  }
}

export async function signAndExecuteTransactionBlock(
  provider: BaseProvider,
  transactionInput: IotaSignTransactionInput
): Promise<IotaSignAndExecuteTransactionOutput> {
  const serialized =
    serializeIotaSignAndExecuteTransactionInput(transactionInput);

  try {
    return (await provider.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: SNAP_ORIGIN,
        request: {
          method: 'signAndExecuteTransactionBlock',
          params: JSON.parse(JSON.stringify(serialized)),
        },
      },
    })) as IotaSignAndExecuteTransactionOutput;
  } catch (e) {
    throw convertError(e);
  }
}

export interface MetaMaskStatus {
  available: boolean;
  version?: string;
  supportsSnaps: boolean;
  iotaSnapInstalled: boolean;
}

export async function metaMaskAvailable(): Promise<MetaMaskStatus> {
  const provider = (await detectEthereumProvider({
    silent: true,
  })) as BaseProvider | null;
  if (!provider) {
    return {
      available: false,
      supportsSnaps: false,
      iotaSnapInstalled: false,
    };
  }
  if (!provider.isMetaMask) {
    return {
      available: false,
      iotaSnapInstalled: false,
      supportsSnaps: false,
    };
  }
  try {
    const version = await provider.request<string>({
      method: 'web3_clientVersion',
    });
    const snaps = await provider.request<Record<string, unknown>>({
      method: 'wallet_getSnaps',
    });
    const iotaSnapInstalled =
      !!snaps && 'npm:@3mate/iota-metamask-snap' in snaps;

    return {
      available: true,
      version: version!,
      supportsSnaps: true,
      iotaSnapInstalled,
    };
  } catch (e) {
    console.warn(e);
    return {
      available: true,
      supportsSnaps: false,
      iotaSnapInstalled: false,
    };
  }
}

export class IotaSnapWallet implements Wallet {
  static NAME = 'Iota MetaMask Snap';
  #connecting: boolean;
  #connected: boolean;

  #accounts: WalletAccount[] | null = null;

  constructor() {
    this.#connecting = false;
    this.#connected = false;
  }

  get version() {
    return '1.0.0' as const;
  }

  get name() {
    return IotaSnapWallet.NAME;
  }

  get icon() {
    return ICON as `data:image/svg+xml;base64,${string}`;
  }

  get chains() {
    return IOTA_CHAINS;
  }

  get connecting() {
    return this.#connecting;
  }

  get accounts() {
    if (this.#connected && this.#accounts) {
      return this.#accounts;
    } else {
      return [];
    }
  }

  get features(): StandardConnectFeature &
    StandardDisconnectFeature &
    IotaFeatures &
    StandardEventsFeature {
    return {
      'standard:connect': {
        version: '1.0.0' as any,
        connect: this.#connect,
      },
      'standard:disconnect': {
        version: '1.0.0' as any,
        disconnect: this.#disconnect,
      },
      'iota:signPersonalMessage': {
        version: '1.0.0' as any,
        signPersonalMessage: this.#signPersonalMessage,
      },
      'iota:signTransaction': {
        version: '1.0.0' as any,
        signTransaction: this.#signTransactionBlock,
      },
      'iota:signAndExecuteTransaction': {
        version: '1.0.0' as any,
        signAndExecuteTransaction: this.#signAndExecuteTransactionBlock,
      },
      'standard:events': {
        version: '1.0.0' as any,
        on: () => {
          return () => {};
        },
      },
    } as any;
  }

  #connect: StandardConnectMethod = async () => {
    if (this.#connecting) {
      throw new Error('Already connecting');
    }

    this.#connecting = true;
    this.#connected = false;

    try {
      const provider = (await detectEthereumProvider({
        silent: true,
      })) as BaseProvider | null;
      if (!provider) {
        throw new Error('MetaMask not detected!');
      }

      const mmStatus = await metaMaskAvailable();
      if (!mmStatus.available) {
        throw new Error('MetaMask not detected!');
      }

      await provider.request({
        method: 'wallet_requestSnaps',
        params: {
          [SNAP_ORIGIN]: {
            version: SNAP_VERSION,
          },
        },
      });

      this.#accounts = await getAccounts(provider);

      this.#connecting = false;
      this.#connected = true;

      return {
        accounts: this.accounts,
      };
    } catch (e) {
      this.#connecting = false;
      this.#connected = false;
      throw e;
    }
  };

  #disconnect: StandardDisconnectMethod = async () => {
    this.#connecting = false;
    this.#connected = false;
    this.#accounts = null;
  };

  #signPersonalMessage: IotaSignPersonalMessageMethod = async (
    messageInput
  ) => {
    const provider = (await detectEthereumProvider({
      silent: true,
    })) as BaseProvider | null;
    if (!provider) {
      throw new Error('MetaMask not detected!');
    }
    return signPersonalMessage(provider, messageInput);
  };

  #signMessage: IotaSignPersonalMessageMethod = async (messageInput) => {
    const provider = (await detectEthereumProvider({
      silent: true,
    })) as BaseProvider | null;
    if (!provider) {
      throw new Error('MetaMask not detected!');
    }
    return signMessage(provider, messageInput);
  };

  #signTransactionBlock: IotaSignTransactionMethod = async (
    transactionInput: IotaSignTransactionInput
  ) => {
    const provider = (await detectEthereumProvider({
      silent: true,
    })) as BaseProvider | null;
    if (!provider) {
      throw new Error('MetaMask not detected!');
    }
    return signTransactionBlock(provider, transactionInput);
  };

  #signAndExecuteTransactionBlock: IotaSignAndExecuteTransactionMethod = async (
    transactionInput: IotaSignTransactionInput
  ) => {
    const provider = (await detectEthereumProvider({
      silent: true,
    })) as BaseProvider | null;
    if (!provider) {
      throw new Error('MetaMask not detected!');
    }
    return signAndExecuteTransactionBlock(provider, transactionInput);
  };
}
