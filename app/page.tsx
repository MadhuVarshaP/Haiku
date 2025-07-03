"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount, usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import { useWriteContracts, useCapabilities } from "wagmi/experimental";
import { haikuABI, haikuAddress } from "../ABIs/haiku";
import { countSyllables } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Heart, Sparkles, Vote, Trophy, PenTool, User, Clock, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Name, Identity, Address, Avatar as OnchainAvatar, EthBalance } from "@coinbase/onchainkit/identity";
import { ConnectWallet, Wallet as WalletComponent, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { writeContracts } from "viem/experimental";

interface HaikuLine {
  text: string;
  author: string;
  avatar?: string;
  syllables: number;
}

interface CompletedHaiku {
  id: string;
  lines: HaikuLine[];
  votes: number;
  hasVoted?: boolean;
}

type AppState = "today" | "voting" | "profile" | "leaderboard";

// Countdown Timer Component
const CountdownTimer = ({ endTime, label }: { endTime: Date; label: string }) => {
  const [timeLeft, setTimeLeft] = useState("00:00:00");

  const stableEndTime = useMemo(() => endTime.getTime(), [endTime]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = stableEndTime - now;

      if (distance > 0) {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      }
      return "00:00:00";
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [stableEndTime]);

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-3">
      <div className="flex items-center justify-center space-x-2">
        <Clock className="w-5 h-5 text-orange-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-orange-800">{label}</p>
          <p className="text-lg font-bold text-orange-900 font-mono">{timeLeft}</p>
        </div>
      </div>
    </div>
  );
};

interface SubmitLineProps {
  lineIndex: number;
  requiredSyllables: number;
  currentHaiku: string[];
  onSuccess: () => void;
}

const SubmitLine = ({ 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lineIndex, 
  requiredSyllables, 
  currentHaiku,
  onSuccess 
}: SubmitLineProps) => {
  const [line, setLine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<null | 'pending' | 'waiting' | 'success' | 'error'>(null);
  
  const account = useAccount();
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
      setTxStatus('pending');
      
      const result = await writeContracts({
        contracts: [{
          address: haikuAddress,
          abi: haikuABI,
          functionName: "submitLineAuto",
          args: [line],
        }],
        capabilities,
      });

      setTxStatus('waiting');
      
      if (result && publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: result,
        });
        
        if (receipt.status === 'success') {
          setTxStatus('success');
          onSuccess();
        } else {
          setTxStatus('error');
          throw new Error("Transaction failed");
        }
      } else if (result && !publicClient) {
        throw new Error("Public client not available");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error submitting line:", error);
      setTxStatus('error');
      let errorMessage = "Failed to submit line";
      
      if (error?.cause?.data?.message?.includes("Line already submitted")) {
        errorMessage = "This line has already been submitted by someone else";
        onSuccess();
      } else if (error?.cause?.message) {
        if (error.cause.message.includes("You already submitted a line today")) {
          errorMessage = "You've already submitted today";
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
            {txStatus === 'pending' ? "Signing..." : "Confirming..."}
          </>
        ) : (
          "Submit Line"
        )}
      </Button>
    </div>
  );
};

const HaikuApp = () => {
  const [currentState, setCurrentState] = useState<AppState>("today");
  const [isModalOpen, setIsModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [votedHaikus, setVotedHaikus] = useState<Set<string>>(new Set());
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [haikuEndTime] = useState(() => {
    const savedTime = typeof window !== 'undefined' ? localStorage.getItem('haikuEndTime') : null;
    return savedTime ? new Date(savedTime) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  });
  const [votingEndTime] = useState(() => new Date(haikuEndTime.getTime() - 6 * 60 * 60 * 1000));
  const [isVoting, setIsVoting] = useState(false);
  const [votingError, setVotingError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('haikuEndTime', haikuEndTime.toISOString());
    }
  }, [haikuEndTime]);

  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const addFrame = useAddFrame();
  
  const account = useAccount();
  const publicClient = usePublicClient();
  
  const { data: todaysHaiku, refetch: refetchTodaysHaiku } = useReadContract({
    address: haikuAddress,
    abi: haikuABI,
    functionName: "getTodaysHaiku",
    query: {
      enabled: !!account.address,
    }
  });

  const { data: hasSubmitted, refetch: refetchHasSubmitted } = useReadContract({
    address: haikuAddress,
    abi: haikuABI,
    functionName: "hasUserSubmittedToday",
    args: [account.address as `0x${string}`],
    query: {
      enabled: !!account.address,
    }
  });

  const { data: nextLineNumber } = useReadContract({
    address: haikuAddress,
    abi: haikuABI,
    functionName: "getNextLineNumber",
    query: {
      enabled: !!account.address,
    }
  });

  // Watch for LineSubmitted events
  useWatchContractEvent({
    address: haikuAddress,
    abi: haikuABI,
    eventName: "LineSubmitted",
    onLogs: () => {
      refetchTodaysHaiku();
      refetchHasSubmitted();
    },
  });

  useEffect(() => {
    if (hasSubmitted !== undefined) {
      setHasSubmittedToday(Boolean(hasSubmitted));
    }
  }, [hasSubmitted]);

  useEffect(() => {
    if (account.address) {
      refetchHasSubmitted();
      refetchTodaysHaiku();
    }
  }, [account.address, refetchHasSubmitted, refetchTodaysHaiku]);

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    try {
      const frameAdded = await addFrame();
      setFrameAdded(Boolean(frameAdded));
    } catch (error) {
      console.error("Failed to add frame:", error);
    }
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-violet-600 p-2 hover:bg-violet-50 rounded-xl"
        >
          <Sparkles className="w-4 h-4 mr-1" />
          Save
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-green-600">
          <Sparkles className="w-4 h-4" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  const getNextLineType = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const completedLines = formatTodaysHaiku();
    const lineNumber = nextLineNumber !== undefined ? Number(nextLineNumber) + 1 : 1;
    const syllableCount = lineNumber === 2 ? 7 : 5;
    return { lineNumber, syllableCount };
  }

  const formatTodaysHaiku = (): HaikuLine[] => {
    if (!todaysHaiku || !Array.isArray(todaysHaiku)) return [];
    
    const lines = todaysHaiku[0] as readonly string[];
    const authors = todaysHaiku[1] as readonly string[];
    const submittedLines = todaysHaiku[3] as number;
    
    const haikuLines: HaikuLine[] = [];
    
    for (let i = 0; i < Math.min(submittedLines, 3); i++) {
      if (lines[i] && authors[i]) {
        haikuLines.push({
          text: lines[i],
          author: authors[i],
          syllables: countSyllables(lines[i]),
        });
      }
    }
    
    return haikuLines;
  }

  const handleVote = async () => {
    if (!account.address) {
      setVotingError("Please connect your wallet first");
      return;
    }

    try {
      setIsVoting(true);
      setVotingError(null);
      
      const result = await writeContracts({
        contracts: [{
          address: haikuAddress,
          abi: haikuABI,
          functionName: "voteForYesterday",
        }],
        capabilities,
      });

      if (result && publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: result,
        });
        
        if (receipt.status === 'success') {
          setVotedHaikus(prev => new Set([...prev, "yesterday"]));
        } else {
          throw new Error("Transaction failed");
        }
      } else if (result && !publicClient) {
        throw new Error("Public client not available");
      }
    } catch (error) {
      console.error("Error voting:", error);
      setVotingError("Failed to vote. Please try again.");
    } finally {
      setIsVoting(false);
    }
  }

  const handleSubmissionSuccess = () => {
    setIsModalOpen(false);
    refetchTodaysHaiku();
    refetchHasSubmitted();
    setHasSubmittedToday(true);
  };

  const renderTodayHaiku = () => {
    const completedLines = formatTodaysHaiku();
    const { lineNumber, syllableCount } = getNextLineType();
    const isComplete = completedLines.length === 3;

    return (
      <div className="space-y-4 font-sans">
        <CountdownTimer endTime={haikuEndTime} label="Haiku closes in" />

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Today&apos;s Progress</h2>
            <div className="flex space-x-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    step <= completedLines.length ? "bg-gradient-to-r from-violet-500 to-purple-500" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isComplete
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : "bg-gradient-to-r from-violet-500 to-purple-500"
              }`}
            >
              {isComplete ? (
                <Sparkles className="w-5 h-5 text-white" />
              ) : (
                <span className="text-white font-bold">{lineNumber}</span>
              )}
            </div>
            <div>
              <p className="font-medium text-slate-800">
                {isComplete ? "Haiku completed! 🎉" : `Line ${lineNumber} needed`}
              </p>
              <p className="text-sm text-slate-500">
                {isComplete ? "Ready for voting" : `${syllableCount} syllables required`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {completedLines.map((line, index) => (
            <div key={index} className="relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start space-x-3">
                <Avatar className="w-10 h-10 ring-2 ring-violet-100">
                  <AvatarImage src={line.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white text-sm">
                    {line.author.slice(2, 4).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-700 text-sm truncate">
                      {line.author.slice(0, 8)}...
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-emerald-100 text-emerald-700"
                    >
                      {line.syllables} syllables
                    </Badge>
                  </div>
                  <p className="font-serif text-lg text-slate-800 leading-relaxed">{line.text}</p>
                </div>
              </div>
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-7 h-7 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                {index + 1}
              </div>
            </div>
          ))}

          {!isComplete && (
            <div className="relative bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-4 border-2 border-dashed border-violet-200">
              <div className="text-center space-y-3">
                {hasSubmittedToday ? (
                  <>
                    <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mx-auto">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">You&apos;ve contributed!</p>
                      <p className="text-sm text-slate-500">
                        Thank you for your submission
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto">
                      <PenTool className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">Line {lineNumber} awaits</p>
                      <p className="text-sm text-slate-500">
                        {syllableCount} syllables needed
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-7 h-7 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                {lineNumber}
              </div>
            </div>
          )}
        </div>

        {!isComplete && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg rounded-2xl py-6 text-lg font-medium"
                disabled={!account.address || hasSubmittedToday}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {hasSubmittedToday 
                  ? "Already Submitted Today" 
                  : !account.address 
                    ? "Connect Wallet to Contribute" 
                    : `Contribute Line ${lineNumber}`
                }
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 rounded-2xl max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-center font-semibold text-slate-800">
                  Add Line {lineNumber} ({syllableCount} syllables)
                </DialogTitle>
              </DialogHeader>
              <SubmitLine 
                lineIndex={lineNumber - 1}
                requiredSyllables={syllableCount}
                currentHaiku={completedLines.map(l => l.text)}
                onSuccess={handleSubmissionSuccess}
              />
            </DialogContent>
          </Dialog>
        )}

        {isComplete && (
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 rounded-3xl shadow-lg">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-800">Today&apos;s Completed Haiku</h3>
                  <p className="text-sm text-slate-500">A collaborative masterpiece</p>
                </div>

                <div className="bg-white/60 rounded-2xl p-6 space-y-4">
                  {completedLines.map((line, index) => (
                    <div key={index} className="space-y-2">
                      <p className="font-serif text-2xl text-slate-800 leading-relaxed font-medium">{line.text}</p>
                      <div className="flex items-center justify-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src="/placeholder.svg?height=24&width=24" />
                          <AvatarFallback className="bg-emerald-200 text-emerald-700 text-xs">
                            {line.author.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm text-slate-600 font-medium">{line.author.slice(0, 8)}...</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center space-y-3">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-full px-6 py-3 text-sm font-medium">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Stored onchain
                  </Badge>
                  <p className="text-xs text-slate-500">Ready for tomorrow&apos;s voting</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderVoting = () => {
  // Move all hooks to the top level
  const { data: yesterdaysHaiku } = useReadContract({
    address: haikuAddress,
    abi: haikuABI,
    functionName: "getYesterdaysHaiku",
    query: {
      enabled: !!account.address,
    }
  });

  const { data: hasVoted } = useReadContract({
    address: haikuAddress,
    abi: haikuABI,
    functionName: "hasVotedOnDay",
    args: [account.address as `0x${string}`, yesterdaysHaiku?.[3] as bigint || BigInt(0)],
    query: {
      enabled: !!account.address && !!yesterdaysHaiku,
    }
  });

  const formatYesterdaysHaiku = (): HaikuLine[] => {
    if (!yesterdaysHaiku || !Array.isArray(yesterdaysHaiku)) return [];
    
    const lines = yesterdaysHaiku[0] as readonly string[];
    const authors = yesterdaysHaiku[1] as readonly string[];
    const submittedLines = yesterdaysHaiku[3] as number;
    const votes = yesterdaysHaiku[2] as number;
    
    const haikuLines: HaikuLine[] = [];
    
    for (let i = 0; i < Math.min(submittedLines, 3); i++) {
      if (lines[i] && authors[i]) {
        haikuLines.push({
          text: lines[i],
          author: authors[i],
          syllables: countSyllables(lines[i]),
        });
      }
    }
    
    return haikuLines;
  };

  const completedLines = formatYesterdaysHaiku();
  const isComplete = completedLines.length === 3;

  if (!isComplete) {
    return (
      <div className="space-y-4">
        <CountdownTimer endTime={votingEndTime} label="Voting opens in" />
        <div className="bg-slate-50 rounded-2xl p-4 text-center">
          <p className="text-slate-500">Yesterday's haiku wasn't completed</p>
          <p className="text-sm text-slate-400 mt-2">No voting available today</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CountdownTimer endTime={votingEndTime} label="Voting closes in" />
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-slate-800">Vote for Yesterday&apos;s Best</h2>
        <p className="text-slate-600">Choose your favorite collaborative haiku</p>
      </div>

      <div className="space-y-4">
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="p-4">
            <div className="text-center space-y-4 mb-6">
              {completedLines.map((line, index) => (
                <div key={index} className="space-y-1">
                  <p className="font-serif text-lg text-slate-800 leading-relaxed">{line.text}</p>
                  <p className="text-xs text-slate-500">{line.author}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-rose-400" />
                <span className="font-semibold text-slate-700">Votes: {yesterdaysHaiku?.[2]?.toString() || 0}</span>
              </div>

              <Button
                onClick={handleVote}
                disabled={hasVoted || isVoting}
                className={`rounded-xl px-6 py-2 font-medium ${
                  hasVoted
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
                }`}
              >
                {hasVoted ? "Voted ✓" : "Vote"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {votingError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-sm text-red-600">{votingError}</p>
        </div>
      )}

      <div className="text-center text-slate-500 bg-slate-50 p-4 rounded-2xl">
        <Vote className="w-4 h-4 inline mr-2 text-slate-400" />
        <span className="text-sm">Votes are stored onchain — one vote per haiku</span>
      </div>
    </div>
  );
}

  const renderProfile = () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: userStreak } = useReadContract({
      address: haikuAddress,
      abi: haikuABI,
      functionName: "getUserStreak",
      args: [account.address as `0x${string}`],
      query: {
        enabled: !!account.address,
      }
    });

    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 rounded-2xl">
          <CardContent className="p-4 text-center">
            <Avatar className="w-20 h-20 mx-auto mb-4 ring-4 ring-indigo-100">
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xl">
                {account.address ? account.address.slice(2, 4).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>

            <h2 className="text-xl font-semibold text-slate-800 mb-1">
              {account.address ? `${account.address.slice(0, 8)}...` : "Not Connected"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">Base Haiku Poet</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3">
                <p className="text-2xl font-bold text-indigo-600">-</p>
                <p className="text-xs text-slate-500">Rank</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="text-2xl font-bold text-rose-500">-</p>
                <p className="text-xs text-slate-500">Votes</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="text-2xl font-bold text-emerald-500">
                  {userStreak?.toString() || "0"}
                </p>
                <p className="text-xs text-slate-500">Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-slate-50 rounded-2xl p-4 text-center">
          <p className="text-slate-500">
            {hasSubmittedToday ? "You've contributed today!" : "No contributions yet."}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {hasSubmittedToday ? "Thank you for your submission!" : "Start contributing to today's haiku!"}
          </p>
        </div>
      </div>
    )
  }

  const renderLeaderboard = () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: winners } = useReadContract({
      address: haikuAddress,
      abi: haikuABI,
      functionName: "getDayWinners",
      args: [BigInt(0)], // Get latest winners
    });

    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-slate-800">Top Haiku</h2>
          <p className="text-slate-600">Most voted collaborative poems</p>
        </div>

        {winners && winners[1] ? (
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-center text-slate-800">Latest Winners</h3>
                <div className="space-y-3">
                  {winners[0].map((winner: string, index: number) => (
                    winner !== "0x0000000000000000000000000000000000000000" && (
                      <div key={index} className="flex items-center space-x-3 bg-white/70 rounded-xl p-3">
                        <Avatar>
                          <AvatarImage src="/placeholder.svg" />
                          <AvatarFallback className="bg-amber-100 text-amber-700">
                            {winner.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-800">{winner.slice(0, 8)}...</p>
                          <p className="text-xs text-slate-500">Line {index + 1} contributor</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <Trophy className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-500">No winners yet</p>
            <p className="text-sm text-slate-400 mt-2">Vote on haiku to see winners here.</p>
          </div>
        )}
      </div>
    )
  }

  const Footer = () => (
    <footer className="mt-8 py-4 border-t border-slate-200 bg-slate-50">
      <div className="max-w-sm mx-auto px-4">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center">
              <PenTool className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-slate-700">Haiku</span>
          </div>
          <p className="text-xs text-slate-500">Collaborative poetry on the blockchain</p>
          <div className="flex items-center justify-center space-x-4 text-xs text-slate-400">
            <button className="hover:text-slate-600">About</button>
            <button className="hover:text-slate-600">Terms</button>
            <button className="hover:text-slate-600">Privacy</button>
          </div>
          <p className="text-xs text-slate-400">© 2025 Haiku. Built with ❤️ for poets.</p>
        </div>
      </div>
    </footer>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50">
      <header className="sticky top-0 bg-white/90 backdrop-blur-md z-50">
        <div className="max-w-sm mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                <PenTool className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Haiku</h1>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentState("leaderboard")}
                className="p-2 hover:bg-violet-50 rounded-xl"
              >
                <Trophy className="w-5 h-5 text-violet-600" />
              </Button>

              <div className="flex items-center space-x-2">
                <WalletComponent className="z-10">
                  <ConnectWallet className="py-1">
                    <Name className="text-inherit" />
                  </ConnectWallet>
                  <WalletDropdown>
                    <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                      <OnchainAvatar />
                      <Name />
                      <Address />
                      <EthBalance />
                    </Identity>
                    <WalletDropdownDisconnect />
                  </WalletDropdown>
                </WalletComponent>
              </div>
              <div>{saveFrameButton}</div>
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-[48px] bg-white/90 backdrop-blur-md">
        <div className="border-b border-slate-300">
          <div className="flex max-w-sm mx-auto px-4">
            {[
              { key: "today", label: "Today's Haiku", icon: PenTool },
              { key: "voting", label: "Voting", icon: Vote },
              { key: "profile", label: "Profile", icon: User },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCurrentState(key as AppState)}
                className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                  currentState === key
                    ? "text-violet-600 border-b-2 border-violet-600 font-semibold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-sm mx-auto px-4 py-4">
        {currentState === "today" && renderTodayHaiku()}
        {currentState === "voting" && renderVoting()}
        {currentState === "profile" && renderProfile()}
        {currentState === "leaderboard" && renderLeaderboard()}
      </main>

      <Footer />
    </div>
  )
}

export default HaikuApp;