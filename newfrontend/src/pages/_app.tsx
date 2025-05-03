import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import {
//   SuiClientProvider,
//   WalletProvider,
//   createNetworkConfig,
// } from "@mysten/dapp-kit";
import {
  IotaClientProvider,
  WalletProvider,
  createNetworkConfig,
} from '@iota/dapp-kit';
import { getFullnodeUrl } from '@iota/iota-sdk/client';

import { registerIotaSnapWallet } from '@/iota-snap-wallet';
import '@iota/dapp-kit/dist/index.css';

// Register the Sui Snap wallet
registerIotaSnapWallet();

// Create a network config for Sui
// const { networkConfig } = createNetworkConfig({
//   testnet: { url: "https://fullnode.testnet.sui.io:443" },
// });

// Config options for the networks you want to connect to
const { networkConfig } = createNetworkConfig({
  localnet: { url: getFullnodeUrl('localnet') },
  testnet: { url: getFullnodeUrl('testnet') },
});

// Create a React Query client
const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <IotaClientProvider networks={networkConfig} network="testnet">
        <WalletProvider>
          <Component {...pageProps} />
        </WalletProvider>
      </IotaClientProvider>
    </QueryClientProvider>
  );
}
