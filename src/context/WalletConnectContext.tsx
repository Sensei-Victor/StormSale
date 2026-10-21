import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useWeb3 } from "./Web3Context";

interface WalletConnectState {
  isConnecting: boolean;
  isSwitchingNetwork: boolean;
  error: string | null;
  showNetworkModal: boolean;
}

interface WalletConnectContextType extends WalletConnectState {
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureStellarNetwork: () => Promise<boolean>;
  clearError: () => void;
  setShowNetworkModal: (show: boolean) => void;
}

const WalletConnectContext = createContext<WalletConnectContextType | undefined>(undefined);

interface WalletConnectProviderProps {
  children: ReactNode;
}

export const WalletConnectProvider: React.FC<WalletConnectProviderProps> = ({ children }) => {
  const [state, setState] = useState<WalletConnectState>({
    isConnecting: false,
    isSwitchingNetwork: false,
    error: null,
    showNetworkModal: false,
  });

  const { connectWallet, disconnectWallet, switchToStellarNetwork, isConnected, isStellarNetwork } =
    useWeb3();

  const disconnectSessionRef = useRef(0);

  // Reactively trigger network modal when wallet is connected but on incorrect network
  useEffect(() => {
    if (isConnected && !isStellarNetwork) {
      setState((prev) => ({ ...prev, showNetworkModal: true }));
    } else if (isStellarNetwork) {
      setState((prev) => ({ ...prev, showNetworkModal: false }));
    }
  }, [isConnected, isStellarNetwork]);

  const connect = async (): Promise<void> => {
    const currentSession = ++disconnectSessionRef.current;
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      await connectWallet();
    } catch (error: any) {
      if (disconnectSessionRef.current !== currentSession) return;
      console.error("Wallet connection error:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to connect wallet",
      }));
    } finally {
      if (disconnectSessionRef.current === currentSession) {
        setState((prev) => ({ ...prev, isConnecting: false }));
      }
    }
  };

  const disconnect = (): void => {
    disconnectSessionRef.current++;
    disconnectWallet();
    setState({
      isConnecting: false,
      isSwitchingNetwork: false,
      error: null,
      showNetworkModal: false,
    });
  };

  const ensureStellarNetwork = async (): Promise<boolean> => {
    if (isStellarNetwork) return true;

    setState((prev) => ({ ...prev, isSwitchingNetwork: true, error: null }));

    try {
      const success = await switchToStellarNetwork();

      if (success) {
        setState((prev) => ({ ...prev, showNetworkModal: false }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          error: "Failed to switch to Stellar network. Please switch manually.",
        }));
        return false;
      }
    } catch (error: any) {
      console.error("Network switch error:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to switch network",
      }));
      return false;
    } finally {
      setState((prev) => ({ ...prev, isSwitchingNetwork: false }));
    }
  };

  const clearError = (): void => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const setShowNetworkModal = (show: boolean): void => {
    setState((prev) => ({ ...prev, showNetworkModal: show }));
  };

  const contextValue: WalletConnectContextType = {
    ...state,
    connect,
    disconnect,
    ensureStellarNetwork,
    clearError,
    setShowNetworkModal,
  };

  return (
    <WalletConnectContext.Provider value={contextValue}>{children}</WalletConnectContext.Provider>
  );
};

export const useWalletConnect = (): WalletConnectContextType => {
  const context = useContext(WalletConnectContext);
  if (context === undefined) {
    throw new Error("useWalletConnect must be used within a WalletConnectProvider");
  }
  return context;
};
