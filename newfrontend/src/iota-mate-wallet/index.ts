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
import {
  SerializedWalletAccount,
  serializeIotaSignAndExecuteTransactionInput,
  serializeIotaSignMessageInput,
  serializeIotaSignTransactionInput,
} from './types';
import { convertError, IotaSnapError } from './errors';
import QRCode from 'qrcode';

export * from './types';
export * from './errors';

// WebSocket server URL
export const WEBSOCKET_SERVER_URL = 'ws://localhost:3001';

export function registerIotaMateWallet(): Wallet {
  const wallets = getWallets();
  for (const wallet of wallets.get()) {
    if (wallet.name === IotaMateWallet.NAME) {
      console.warn('IotaMateWallet already registered');
      return wallet;
    }
  }

  const wallet = new IotaMateWallet();
  wallets.register(wallet as unknown as Wallet);
  return wallet;
}

// WebSocket connection class
class WebSocketConnection {
  private ws: WebSocket | null = null;
  private connectionKey: string | null = null;
  private resolvers: Map<string, { resolve: Function; reject: Function }> =
    new Map();
  public accounts: ReadonlyWalletAccount[] | null = null;
  public isConnecting: boolean = false;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  async connect(): Promise<ReadonlyWalletAccount[]> {
    if (this.isConnecting) {
      throw new IotaSnapError('Already connecting to WebSocket');
    }

    if (this.isConnected && this.accounts) {
      return this.accounts;
    }

    this.isConnecting = true;

    try {
      await this.establishConnection();
      const key = await this.requestConnectionKey();
      await this.showQRCodePopup(key);
      this.accounts = await this.waitForAuthentication(key);

      this.isConnecting = false;
      this.isConnected = true;

      return this.accounts;
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      throw error;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionKey = null;
    this.accounts = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.resolvers.clear();
  }

  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WEBSOCKET_SERVER_URL);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = this.handleMessage;
        this.ws.onclose = this.handleClose;
        this.ws.onerror = (event) => {
          this.handleError(event);
          reject(new IotaSnapError('WebSocket connection error'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private async requestConnectionKey(): Promise<string> {
    if (!this.ws) {
      throw new IotaSnapError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: 'requestConnectionKey',
          params: {},
        })
      );

      // Set timeout for key request
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError('Connection key request timeout'));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  private async showQRCodePopup(key: string): Promise<void> {
    try {
      // Store the connection key
      this.connectionKey = key;

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(key);

      // Create popup window
      const popupWindow = window.open(
        '',
        'IotaMateWalletQRCode',
        'width=350,height=450'
      );
      if (!popupWindow) {
        throw new IotaSnapError(
          'Could not open QR code popup. Please allow popups for this site.'
        );
      }

      // Set popup content
      popupWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Iota Mate Wallet</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 10px;
              padding: 20px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            h2 {
              color: #333;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              margin-bottom: 20px;
            }
            img {
              max-width: 200px;
              height: auto;
              margin: 0 auto;
              display: block;
              border: 1px solid #eee;
            }
            .key {
              font-family: monospace;
              background-color: #f0f0f0;
              padding: 8px;
              border-radius: 4px;
              word-break: break-all;
              margin-top: 15px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Iota Mate Wallet</h2>
            <p>Scan this QR code with your mobile wallet app</p>
            <img src="${qrCodeDataUrl}" alt="QR Code" />
            <div class="key">
              <strong>Connection Key:</strong><br>
              ${key}
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error showing QR code:', error);
      throw new IotaSnapError('Failed to display QR code');
    }
  }

  private async waitForAuthentication(
    key: string
  ): Promise<ReadonlyWalletAccount[]> {
    if (!this.ws) {
      throw new IotaSnapError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: 'authenticate',
          params: { key },
        })
      );

      // Set timeout for authentication
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError('Authentication timeout'));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  async signPersonalMessage(
    messageInput: IotaSignPersonalMessageInput
  ): Promise<IotaSignPersonalMessageOutput> {
    if (!this.ws) {
      throw new IotaSnapError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: 'signPersonalMessage',
          params: serializeIotaSignMessageInput(messageInput),
        })
      );

      // Set timeout for signing
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError('Signing timeout'));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  async signTransaction(
    transactionInput: IotaSignTransactionInput
  ): Promise<IotaSignTransactionOutput> {
    if (!this.ws) {
      throw new IotaSnapError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: 'signTransaction',
          params: serializeIotaSignTransactionInput(transactionInput),
        })
      );

      // Set timeout for signing
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError('Signing timeout'));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  async signAndExecuteTransaction(
    transactionInput: IotaSignTransactionInput
  ): Promise<IotaSignAndExecuteTransactionOutput> {
    if (!this.ws) {
      throw new IotaSnapError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      this.resolvers.set(requestId, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          id: requestId,
          method: 'signAndExecuteTransaction',
          params: serializeIotaSignAndExecuteTransactionInput(transactionInput),
        })
      );

      // Set timeout for signing and execution
      setTimeout(() => {
        if (this.resolvers.has(requestId)) {
          this.resolvers.delete(requestId);
          reject(new IotaSnapError('Signing and execution timeout'));
        }
      }, 30000); // 30 seconds timeout
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const response = JSON.parse(event.data);
      const { id, result, error } = response;

      if (this.resolvers.has(id)) {
        const { resolve, reject } = this.resolvers.get(id)!;
        this.resolvers.delete(id);

        if (error) {
          reject(new IotaSnapError(error.message || 'Unknown error'));
        } else {
          resolve(result);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;

    // Clear all pending requests
    for (const [id, { reject }] of this.resolvers) {
      reject(new IotaSnapError('WebSocket connection closed'));
      this.resolvers.delete(id);
    }

    // Attempt to reconnect if not manually disconnected
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        if (!this.isConnected && !this.isConnecting) {
          this.connect().catch(console.error);
        }
      }, this.reconnectTimeout * this.reconnectAttempts);
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export function isWebSocketAvailable(): boolean {
  return typeof WebSocket !== 'undefined';
}

export class IotaMateWallet implements Wallet {
  static NAME = 'Iota Mate Wallet';
  private connection: WebSocketConnection;

  constructor() {
    this.connection = new WebSocketConnection();
  }

  get version() {
    return '1.0.0' as const;
  }

  get name() {
    return IotaMateWallet.NAME;
  }

  get icon() {
    return ICON as `data:image/svg+xml;base64,${string}`;
  }

  get chains() {
    return ['iota:mainnet', 'iota:testnet', 'iota:devnet'] as const;
  }

  get connecting() {
    return this.connection.isConnecting;
  }

  get accounts() {
    return this.connection.accounts || [];
  }

  get features(): StandardConnectFeature &
    StandardDisconnectFeature &
    IotaFeatures &
    StandardEventsFeature {
    return {
      'standard:connect': {
        version: '1.0.0' as any,
        connect: this.connection.connect.bind(this.connection),
      },
      'standard:disconnect': {
        version: '1.0.0' as any,
        disconnect: this.connection.disconnect.bind(this.connection),
      },
      'iota:signPersonalMessage': {
        version: '1.0.0' as any,
        signPersonalMessage: this.connection.signPersonalMessage.bind(
          this.connection
        ),
      },
      'iota:signTransaction': {
        version: '1.0.0' as any,
        signTransaction: this.connection.signTransaction.bind(this.connection),
      },
      'iota:signAndExecuteTransaction': {
        version: '1.0.0' as any,
        signAndExecuteTransaction:
          this.connection.signAndExecuteTransaction.bind(this.connection),
      },
      'standard:events': {
        version: '1.0.0' as any,
        on: () => {
          return () => {};
        },
      },
    } as any;
  }
}
