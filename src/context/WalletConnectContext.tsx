import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { useWeb3 } from "./Web3Context";

const WALLETCONNECT_SESSION_KEY = "stormsale_walletconnect_session";

export interface WalletConnectSession {
  topic?: string;
  peerMeta?: {
    name?: string;
    description?: string;
    icons?: string[];
  };
  connectedAt: number;
}

export interface WalletConnectCoreProvider {
  isInitialized: boolean;
  init: () => Promise<void>;
  connect: () => Promise<WalletConnectSession>;
  disconnect: () => Promise<void>;
  getSession: () => WalletConnectSession | null;
}

/**
 * Singleton instance manager for WalletConnect.
 * Lives outside the React component lifecycle to prevent multiple initializations
 * when React 18/19 StrictMode double-mounts components in development.
 */
class WalletConnectSingleton {
  private static instance: WalletConnectSingleton | null = null;
  private isInitialized = false;
  private initPromise: Promise<WalletConnectCoreProvider> | null = null;
  private session: WalletConnectSession | null = null;

  private constructor() {
    this.restoreSession();
  }

  public static getInstance(): WalletConnectSingleton {
    if (!WalletConnectSingleton.instance) {
      WalletConnectSingleton.instance = new WalletConnectSingleton();
    }
    return WalletConnectSingleton.instance;
  }

  /**
   * Resets the singleton instance (useful for testing).
   */
  public static resetInstance(): void {
    if (WalletConnectSingleton.instance) {
      WalletConnectSingleton.instance.isInitialized = false;
      WalletConnectSingleton.instance.initPromise = null;
      WalletConnectSingleton.instance.session = null;
      WalletConnectSingleton.instance = null;
    }
  }

  private restoreSession(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(WALLETCONNECT_SESSION_KEY);
        if (stored) {
          this.session = JSON.parse(stored) as WalletConnectSession;
        }
      }
    } catch (err) {
      console.warn("Could not restore WalletConnect session from storage:", err);
    }
  }

  public initialize(): Promise<WalletConnectCoreProvider> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const coreProvider: WalletConnectCoreProvider = {
          isInitialized: true,
          init: async () => {},
          connect: async () => {
            const newSession: WalletConnectSession = {
              topic: "wc_" + Math.random().toString(36).substring(2, 12),
              peerMeta: {
                name: "StormSale Mobile",
                description: "Stellar Affiliate Escrow Platform",
              },
              connectedAt: Date.now(),
            };

            this.session = newSession;

            try {
              if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem(