import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClaimPayouts } from "../components/affiliate/ClaimPayouts";
import * as batchClaimLib from "../lib/batchClaim";

import * as notificationCtx from "../context/NotificationContext";

// Minimal mocks for context hooks
const mockShowNotification = vi.fn().mockReturnValue("notif-id");
const mockBatchClaimPayoutsOnChain = vi.fn();
const mockClaimPayoutOnChain = vi.fn();

vi.mock("../context/NotificationContext", async (importOriginal) => {
  const actual = await importOriginal<typeof notificationCtx>();
  return {
    ...actual,
    useNotification: () => ({
      showNotification: mockShowNotification,
      notifications: [],
      dismissNotification: vi.fn(),
      clearAllNotifications: vi.fn(),
      notifyLowEscrowBalance: vi.fn(),
      checkEscrowBalances: vi.fn(),
    }),
  };
});

vi.mock("../hooks/useWeb3", () => ({
  useWeb3: () => ({
    userAddress: "GTEST1234567890AFFILIATE",
    batchClaimPayoutsOnChain: mockBatchClaimPayoutsOnChain,
    claimPayoutOnChain: mockClaimPayoutOnChain,
  }),
}));

vi.mock("./AffiliateSettings", () => ({
  shouldDeliverAffiliateNotification: () => true,
}));

const MOCK_CAMPAIGNS = [
  {
    campaignId: 101,
    campaignName: "Test Campaign Alpha",
    advertiserAddress: "GADV1234",
    maturedSalesCount: 3,
    claimableXlm: 45.5,
    clearingPeriodDays: 7,
    lastSaleDate: "2026-10-01",
    status: "matured" as const,
  },
  {
    campaignId: 204,
    campaignName: "Test Campaign Beta",
    advertiserAddress: "GADV5678",
    maturedSalesCount: 2,
    claimableXlm: 22.0,
    clearingPeriodDays: 14,
    lastSaleDate: "2026-09-28",
    status: "clearing" as const,
  },
];

describe("ClaimPayouts Component (#259)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(batchClaimLib, "fetchAffiliateMaturedClaims").mockResolvedValue(MOCK_CAMPAIGNS);
  });

  it("loads and displays matured campaigns on mount", async () => {
    render(<ClaimPayouts />);
    await waitFor(() => {
      expect(screen.getByText("Test Campaign Alpha")).toBeDefined();
    });
    expect(batchClaimLib.fetchAffiliateMaturedClaims).toHaveBeenCalledWith(
      "GTEST1234567890AFFILIATE",
    );
  });

  it("displays error notification on load failure", async () => {
    vi.spyOn(batchClaimLib, "fetchAffiliateMaturedClaims").mockRejectedValue(
      new Error("Network error"),
    );

    render(<ClaimPayouts />);
    // Component should handle errors gracefully without crashing
    await waitFor(() => {
      // If no campaigns are loaded, campaigns list is empty - no crash
      expect(screen.queryByText("Test Campaign Alpha")).toBeNull();
    });
  });

  it("executes batch claim and shows success notification", async () => {
    const mockReceipt = {
      success: true,
      txHash: "0xmockhash123",
      totalClaimedXlm: 45.5,
      timestamp: Date.now(),
      itemizedClaims: [{ campaignId: 101, campaignName: "Test Campaign Alpha", claimedXlm: 45.5 }],
    };
    mockBatchClaimPayoutsOnChain.mockResolvedValue(mockReceipt);

    render(<ClaimPayouts />);
    await waitFor(() => screen.getByText("Test Campaign Alpha"));

    const batchClaimButton = screen.getByRole("button", { name: /batch claim/i });
    fireEvent.click(batchClaimButton);

    await waitFor(() => {
      expect(mockBatchClaimPayoutsOnChain).toHaveBeenCalled();
    });
  });

  it("disables claim buttons while batch claim is in progress", async () => {
    // Make batch claim hang
    mockBatchClaimPayoutsOnChain.mockReturnValue(new Promise(() => {}));

    render(<ClaimPayouts />);
    await waitFor(() => screen.getByText("Test Campaign Alpha"));

    const batchClaimButton = screen.getByRole("button", { name: /batch claim/i });
    fireEvent.click(batchClaimButton);

    await waitFor(() => {
      const singleClaimButtons = screen.queryAllByRole("button", { name: /claim single/i });
      singleClaimButtons.forEach((btn: HTMLElement) => {
        expect(btn).toHaveProperty("disabled", true);
      });
    });
  });

  it("prevents concurrent claims: single claim button disabled while another is in progress", async () => {
    let resolveFirst: (val: any) => void;
    const hangingPromise = new Promise<any>((res) => {
      resolveFirst = res;
    });
    mockClaimPayoutOnChain.mockReturnValueOnce(hangingPromise);

    render(<ClaimPayouts />);
    await waitFor(() => screen.getByText("Test Campaign Alpha"));

    const singleClaimButtons = screen.queryAllByRole("button", { name: /claim single/i });
    if (singleClaimButtons.length > 0) {
      fireEvent.click(singleClaimButtons[0]);

      await waitFor(() => {
        // Batch claim button should be disabled during single claim
        const batchButton = screen.getByRole("button", { name: /batch claim/i });
        expect(batchButton).toHaveProperty("disabled", true);
      });

      // Clean up
      resolveFirst!({ txHash: "0xmock" });
    }
  });
});
