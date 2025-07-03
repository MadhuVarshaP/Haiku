"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useWriteContracts, useCapabilities } from "wagmi/experimental";
import { haikuABI, haikuAddress } from "../../ABIs/haiku";
import { countSyllables } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface SubmitLineProps {
  lineIndex: number;
  requiredSyllables: number;
  currentHaiku: string[];
  onSuccess: () => void;
}

export default function SubmitLine({ 
  lineIndex, 
  requiredSyllables, 
  currentHaiku,
  onSuccess 
}: SubmitLineProps) {
  const [line, setLine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | undefined>(undefined);

  const account = useAccount();

  const { writeContracts } = useWriteContracts({
    mutation: {
      onSuccess: (data) => {
        console.log("✅ TX ID:", data.id);
        setTxId(data.id);
        setIsSubmitting(false);
        setSubmitError(null);
        onSuccess();
      },
      onError: (error) => {
        console.error("❌ TX failed:", error?.cause || error);
        setIsSubmitting(false);
        const errorMessage = error.message || "Failed to submit line";

        if (errorMessage.includes("You already submitted a line today")) {
          setSubmitError("You've already submitted a line today");
          onSuccess();
        } else {
          setSubmitError(errorMessage);
        }
      }
    }
  });

  const { data: availableCapabilities } = useCapabilities({
    account: account.address,
  });

  const capabilities = useMemo(() => {
    if (!availableCapabilities || !account.chainId) return {};
    const chainCaps = availableCapabilities[account.chainId];
    if (chainCaps?.paymasterService?.supported) {
      return {
        PaymasterService: {
          url: `${window.location.origin}/api/paymaster`,
        },
      };
    }
    return {};
  }, [availableCapabilities, account.chainId]);

  const currentSyllables = countSyllables(line);

  const handleSubmit = () => {
    if (!line.trim()) {
      setSubmitError("Please enter a line");
      return;
    }

    if (currentSyllables !== requiredSyllables) {
      setSubmitError(`Line must have exactly ${requiredSyllables} syllables`);
      return;
    }

    if (!account.address) {
      setSubmitError("Please connect your wallet");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    writeContracts({
      contracts: [{
        address: haikuAddress,
        abi: haikuABI,
        functionName: "submitLine",
        args: [BigInt(lineIndex), line],
      }],
      capabilities,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-xl p-3">
        <p className="text-sm font-medium text-slate-600 mb-2">Current haiku:</p>
        {currentHaiku.map((line, index) => (
          <p key={index} className="font-serif text-slate-700 italic text-sm">
            {line}
          </p>
        ))}
      </div>

      <Textarea
        placeholder={`Enter your ${requiredSyllables}-syllable line...`}
        value={line}
        onChange={(e) => setLine(e.target.value)}
        className="resize-none border-violet-200 focus:border-violet-400 rounded-xl font-serif"
        rows={3}
        disabled={isSubmitting}
      />

      <div className="flex items-center justify-between text-sm bg-slate-50 rounded-xl p-3">
        <span className="text-slate-600">
          Syllables: {currentSyllables}/{requiredSyllables}
        </span>
        <span className={currentSyllables === requiredSyllables ? "text-emerald-600 font-medium" : "text-slate-400"}>
          {currentSyllables === requiredSyllables ? "Perfect! ✨" : "Keep going..."}
        </span>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      {txId && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-sm text-green-600">Line submitted successfully!</p>
          <p className="text-xs text-green-500 mt-1">TX: {String(txId).slice(0, 10)}...</p>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl py-3 font-medium"
        disabled={!line.trim() || currentSyllables !== requiredSyllables || isSubmitting || !account.address}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Line"
        )}
      </Button>
    </div>
  );
}
