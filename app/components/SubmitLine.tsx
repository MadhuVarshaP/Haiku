"use client";

import { useState, useMemo } from "react";
import { useAccount, usePublicClient } from "wagmi";
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
  
  const account = useAccount();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const publicClient = usePublicClient();
  const { writeContracts } = useWriteContracts();
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
        }
      };
    }
    return {};
  }, [availableCapabilities, account.chainId]);

  const currentSyllables = countSyllables(line);

  const handleSubmit = async () => {
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

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      await writeContracts({
        contracts: [{
          address: haikuAddress,
          abi: haikuABI,
          functionName: "submitLine",
          args: [BigInt(lineIndex), line],
        }],
        capabilities,
      });

      // Transaction was submitted successfully
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error submitting line:", error);
      let errorMessage = "Failed to submit line";
      
      if (error?.cause?.message) {
        if (error.cause.message.includes("You already submitted a line today")) {
          errorMessage = "You've already submitted today";
        } else if (error.cause.message.includes("Line already submitted")) {
          errorMessage = "This line has already been submitted";
        } else {
          errorMessage = error.cause.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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