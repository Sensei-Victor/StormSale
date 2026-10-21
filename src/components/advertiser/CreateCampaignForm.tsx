import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { InputField } from "../../components/ui/input-group";
import { TerminologyTooltip } from "../../components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useWeb3 } from "../../hooks/useWeb3";
import { useNotification } from "../../context/NotificationContext";
import { getCreateCampaignSchema, getFieldErrors } from "../../lib/validation";
import { CONTRACT_ADDRESSES } from "../../config/contracts";
import { formatStellarAddress } from "../../lib/stellar";
import {
  Zap,
  Target,
  Clock,
  DollarSign,
  Coins,
  ChevronDown,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Lock,
} from "lucide-react";
import { SUPPORTED_ESCROW_ASSETS } from "../../config/stellar";
import type { SupportedEscrowAssetCode } from "../../config/stellar";

export type FlowStep =
  "idle" | "checking" | "approving" | "approved" | "creating" | "success" | "error";

export const CreateCampaignForm = () => {
  const [selectedAsset, setSelectedAsset] = useState<SupportedEscrowAssetCode>("XLM");
  const [commissionRate, setCommissionRate] = useState("");
  const [clearingPeriod, setClearingPeriod] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [budget, setBudget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [isRefreshingAllowance, setIsRefreshingAllowance] = useState(false);
  const [lastCreatedCampaign, setLastCreatedCampaign] = useState<{
    campaignId: number;
    txHash?: string;
  } | null>(null);

  const [assetAllowances, setAssetAllowances] = useState<Record<SupportedEscrowAssetCode, number>>({
    XLM: 0,
    USDC: 0,
    EURC: 0,
  });

  const {
    createCampaignOnChain,
    isConnected,
    userAddress,
    tokenAllowance,
    refreshTokenAllowance,
    approveTokenAllowance,
    assetBalances,
    isMultiSigAccount,
    openMultiSigModal,
  } = useWeb3();
  const { showNotification } = useNotification();

  // Numeric calculations
  const parsedBudget = parseFloat(budget);
  const maxDecimals = SUPPORTED_ESCROW_ASSETS[selectedAsset]?.decimals ?? 7;
  const fracDigits = budget.includes(".") ? (budget.split(".")[1]?.length ?? 0) : 0;
  const isValidBudget = Boolean(
    budget &&
    !isNaN(parsedBudget) &&
    isFinite(parsedBudget) &&
    parsedBudget > 0 &&
    fracDigits <= maxDecimals,
  );
  const budgetNum = isValidBudget ? parsedBudget : 0;
  const currentAssetAllowance = assetAllowances[selectedAsset] ?? tokenAllowance;
  const isAllowanceSufficient = isConnected && isValidBudget && currentAssetAllowance >= budgetNum;
  const allowanceDeficit = Math.max(0, budgetNum - currentAssetAllowance);
  const isExecuting = flowStep === "approving" || flowStep === "creating";

  // Poll or refresh allowance on address change, mount, or asset switch
  useEffect(() => {
    if (isConnected && userAddress) {
      refreshTokenAllowance(undefined, selectedAsset).then((val) => {
        setAssetAllowances((prev) => ({ ...prev, [selectedAsset]: val }));
      });
    }
  }, [isConnected, userAddress, selectedAsset, refreshTokenAllowance]);
