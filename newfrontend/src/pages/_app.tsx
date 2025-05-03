import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  IotaClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@iota/dapp-kit";
import { registerSuiSnapWallet } from "@/sui-snap-wallet";
import "@iota/dapp-kit/dist/index.css";

// Register the Sui Snap wallet
registerSuiSnapWallet();

// Create a network config for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://fullnode.testnet.sui.io:443" },
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
