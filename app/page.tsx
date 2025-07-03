"use client"

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
// import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Heart, Sparkles, Vote, Trophy, PenTool, User, Clock } from "lucide-react";
import SubmitLine from "./components/SubmitLine";
import { countSyllables } from "@/lib/utils";

// Base/OnchainKit imports
import {
  useMiniKit,
  useAddFrame,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar as OnchainAvatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet as WalletComponent,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";

// Wagmi imports
import { useAccount, useReadContract } from "wagmi";
import { haikuABI, haikuAddress } from "../ABIs/haiku";

type AppState = "today" | "voting" | "profile" | "leaderboard"

interface HaikuLine {
  text: string
  author: string
  avatar?: string
  syllables: number
}

interface CompletedHaiku {
  id: string
  lines: HaikuLine[]
  votes: number
  hasVoted?: boolean
}

// Countdown Timer Component
const CountdownTimer = ({ endTime, label }: { endTime: Date; label: string }) => {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = endTime.getTime() - now

      if (distance > 0) {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)

        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        )
      } else {
        setTimeLeft("00:00:00")
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime])

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
  )
}

export default function HaikuApp() {
  const [currentState, setCurrentState] = useState<AppState>("today")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [votedHaikus, setVotedHaikus] = useState<Set<string>>(new Set())
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);

  // Voting state
  const [isVoting, setIsVoting] = useState(false)
  const [votingError, setVotingError] = useState<string | null>(null)
  
  // MiniKit hooks
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const addFrame = useAddFrame();
  
  // Wagmi hooks
  const account = useAccount();
  
  // Contract reads
  const { data: todaysHaiku, refetch: refetchTodaysHaiku } = useReadContract({
    address: haikuAddress,
    abi: haikuABI,
    functionName: "getTodaysHaiku",
    query: {
      enabled: !!account.address,
    }
  });

  const { data: hasSubmitted } = useReadContract({
  address: haikuAddress,
  abi: haikuABI,
  functionName: "hasSubmitted",
  args: [account.address],
  query: {
    enabled: !!account.address,
  }
});

useEffect(() => {
  if (hasSubmitted !== undefined) {
    setHasSubmittedToday(hasSubmitted);
  }
}, [hasSubmitted]);
  // MiniKit setup
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

  // Mock end times (24 hours from now)
  const haikuEndTime = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const votingEndTime = new Date(Date.now() + 18 * 60 * 60 * 1000)

  // Get next line number and syllable count
  const getNextLineType = () => {
    const completedLines = formatTodaysHaiku();
    const lineNumber = completedLines.length + 1;
    const syllableCount = lineNumber === 2 ? 7 : 5; // Second line needs 7 syllables
    return { lineNumber, syllableCount };
  }

  // Convert contract data to display format
// Convert contract data to display format
const formatTodaysHaiku = (): HaikuLine[] => {
  if (!todaysHaiku || !Array.isArray(todaysHaiku)) return [];
  
  const lines = todaysHaiku[0] as string[];
  const authors = todaysHaiku[1] as string[];
  const submittedLines = todaysHaiku[2] as bigint; // This is BigInt
  
  // Convert BigInt to number
  const submittedLinesCount = Number(submittedLines);
  
  const haikuLines: HaikuLine[] = [];
  
  // Only process submitted lines
  for (let i = 0; i < Math.min(submittedLinesCount, 3); i++) {
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

  // Handle voting
  const handleVote = async (haikuId: string) => {
    if (!account.address) {
      setVotingError("Please connect your wallet first");
      return;
    }

    if (votedHaikus.has(haikuId)) return;

    try {
      setIsVoting(true);
      setVotingError(null);
      
      // In a real app, you'd call your contract here
      // This is a mock implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setVotedHaikus(prev => new Set([...prev, haikuId]));
      console.log(`Voted for haiku ${haikuId}`);
    } catch (error) {
      console.error("Error voting:", error);
      setVotingError("Failed to vote. Please try again.");
    } finally {
      setIsVoting(false);
    }
  }

  const renderTodayHaiku = () => {
    const completedLines = formatTodaysHaiku();
    const { lineNumber, syllableCount } = getNextLineType();
    const isComplete = completedLines.length === 3;

    return (
      <div className="space-y-4 font-sans">
        {/* Timer */}
        <CountdownTimer endTime={haikuEndTime} label="Haiku closes in" />

        {/* Progress Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Today's Progress</h2>
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

        {/* Haiku Lines */}
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
            <p className="font-medium text-slate-700">You've contributed!</p>
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

        {/* Action Button */}
        {!isComplete && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg rounded-2xl py-6 text-lg font-medium"
                disabled={!account.address}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {!account.address ? "Connect Wallet to Contribute" : `Contribute Line ${lineNumber}`}
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
                onSuccess={() => {
                  setIsModalOpen(false);
                  refetchTodaysHaiku();
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Completed Haiku Display */}
        {isComplete && (
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 rounded-3xl shadow-lg">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-slate-800">Today's Completed Haiku</h3>
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
                  <p className="text-xs text-slate-500">Ready for tomorrow's voting</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderVoting = () => {
    const votingHaikus: CompletedHaiku[] = [
      {
        id: "1",
        lines: [
          { text: "Morning dew glistens", author: "@dawn_writer", syllables: 5 },
          { text: "On petals soft and tender", author: "@flower_child", syllables: 7 },
          { text: "Sun breaks through the mist", author: "@light_seeker", syllables: 5 },
        ],
        votes: 24,
      },
    ];

    return (
      <div className="space-y-4">
        <CountdownTimer endTime={votingEndTime} label="Voting closes in" />
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-slate-800">Vote for Yesterday's Best</h2>
          <p className="text-slate-600">Choose your favorite collaborative haiku</p>
        </div>

        <div className="space-y-4">
          {votingHaikus.map((haiku) => {
            const hasVoted = votedHaikus.has(haiku.id);
            return (
              <Card key={haiku.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className="text-center space-y-4 mb-6">
                    {haiku.lines.map((line, index) => (
                      <div key={index} className="space-y-1">
                        <p className="font-serif text-lg text-slate-800 leading-relaxed">{line.text}</p>
                        <p className="text-xs text-slate-500">{line.author}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-rose-400" />
                      <span className="font-semibold text-slate-700">{haiku.votes} votes</span>
                    </div>

                    <Button
                      onClick={() => handleVote(haiku.id)}
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
            );
          })}
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

  const renderProfile = () => (
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
              <p className="text-2xl font-bold text-emerald-500">-</p>
              <p className="text-xs text-slate-500">Haiku</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-slate-50 rounded-2xl p-4 text-center">
        <p className="text-slate-500">No contributions yet.</p>
        <p className="text-sm text-slate-400 mt-2">Start contributing to today's haiku!</p>
      </div>
    </div>
  )

  const renderLeaderboard = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-slate-800">Top Haiku</h2>
        <p className="text-slate-600">Most voted collaborative poems</p>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 text-center">
        <Trophy className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <p className="text-slate-500">Leaderboard coming soon!</p>
        <p className="text-sm text-slate-400 mt-2">Vote on haiku to see rankings here.</p>
      </div>
    </div>
  )

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
      {/* Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md z-50">
        <div className="max-w-sm mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                <PenTool className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Haiku</h1>
              </div>
            </div>

            {/* Right Side */}
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

      {/* Navigation */}
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

      {/* Main Content */}
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