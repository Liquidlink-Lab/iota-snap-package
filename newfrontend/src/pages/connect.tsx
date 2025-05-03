import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ConnectModal,
  useCurrentAccount,
  useCurrentWallet,
} from '@mysten/dapp-kit';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function Connect() {
  const router = useRouter();
  const { key } = router.query;
  const [error, setError] = useState<string | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const { isConnected, currentWallet } = useCurrentWallet();
  const currentAccount = useCurrentAccount();

  // Handle connection when wallet is connected and key is available
  useEffect(() => {
    if (isConnected && currentAccount && key && !connecting && !connected) {
      handleConnect();
    }
  }, [isConnected, currentAccount, key, connecting, connected]);

  // Handle connection to backend
  const handleConnect = async () => {
    if (!key || !currentAccount) return;

    setConnecting(true);
    try {
      // Connect to WebSocket server
      const ws = new WebSocket('ws://localhost:3001');

      // Wait for WebSocket to open
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Authenticate connection with the key
      ws.send(
        JSON.stringify({
          id: 'auth-' + Date.now(),
          method: 'authenticateConnection',
          params: {
            key: key,
            address: currentAccount.address,
            publicKey: currentAccount.publicKey
              ? btoa(
                  String.fromCharCode(
                    ...new Uint8Array(currentAccount.publicKey)
                  )
                )
              : '',
            privateKey: 'dummy-private-key', // We don't actually send the private key
          },
        })
      );

      // Wait for authentication response
      const response = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          resolve(data);
        };
      });

      // Close WebSocket
      ws.close();

      if (response.error) {
        throw new Error(response.error.message || 'Authentication failed');
      }

      setConnected(true);
      setConnecting(false);

      // Emit a browser event to notify the parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'sui-mate-wallet-connected',
            address: currentAccount.address,
            publicKey: currentAccount.publicKey
              ? btoa(
                  String.fromCharCode(
                    ...new Uint8Array(currentAccount.publicKey)
                  )
                )
              : '',
          },
          '*'
        );
        // Close this window after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      }
    } catch (error) {
      console.error('Connection error:', error);
      setError((error as Error).message);
      setConnecting(false);
    }
  };

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]`}
    >
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-3xl">
        <div className="flex flex-col items-center gap-4 w-full">
          <h1 className="text-3xl font-bold mt-8 mb-4">
            Connect to Iota Mate Wallet
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {connected ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 w-full text-center">
              <strong className="font-bold">Connected! </strong>
              <span className="block sm:inline">
                You can close this window now.
              </span>
            </div>
          ) : connecting ? (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4 w-full text-center">
              <strong className="font-bold">Connecting... </strong>
              <span className="block sm:inline">
                Please wait while we connect to the wallet.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                Connect your wallet to authenticate with Iota Mate Wallet
              </p>

              <ConnectModal
                trigger={
                  <button className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full">
                    Connect Wallet
                  </button>
                }
              />

              {isConnected && currentAccount && (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
                  <h3 className="font-bold mb-2">Connected Account</h3>
                  <p className="text-sm mb-2">
                    <span className="font-semibold">Wallet:</span>{' '}
                    {currentWallet?.name}
                  </p>
                  <p className="font-mono text-sm break-all">
                    {currentAccount.address}
                  </p>
                  <button
                    onClick={handleConnect}
                    className="mt-4 px-4 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white w-full"
                  >
                    Connect to Iota Mate Wallet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
