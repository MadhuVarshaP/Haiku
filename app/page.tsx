"use client"

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Heart, Sparkles, Vote, Trophy, PenTool, User, Share, Flame, Clock } from "lucide-react"
import { Icon } from "./components/DemoComponents";
import {
  useMiniKit,
  useAddFrame,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Avatar as OnchainAvatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface LeaderboardUser {
  id: string
  username: string
  avatar?: string
  totalVotes: number
  totalContributions: number
  bestHaiku?: {
    lines: string[]
    votes: number
  }
  rank: number
  streak?: number
}

interface UserProfile {
  id: string
  username: string
  avatar?: string
  joinDate: string
  totalVotes: number
  totalContributions: number
  rank: number
  contributions: {
    id: string
    haikuLines: string[]
    myLine: string
    linePosition: number
    votes: number
    date: string
    collaborators: string[]
    isTopVoted?: boolean
  }[]
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
  const [newLine, setNewLine] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  // const [isWalletConnected, setIsWalletConnected] = useState(true)
  const [votedHaikus, setVotedHaikus] = useState<Set<string>>(new Set())
  const { setFrameReady, isFrameReady, context } = useMiniKit();
   const [frameAdded, setFrameAdded] = useState(false);

     const addFrame = useAddFrame();


     useEffect(() => {
       if (!isFrameReady) {
         setFrameReady();
       }
     }, [setFrameReady, isFrameReady]);
   
     const handleAddFrame = useCallback(async () => {
       const frameAdded = await addFrame();
       setFrameAdded(Boolean(frameAdded));
     }, [addFrame]);
   
     const saveFrameButton = useMemo(() => {
       if (context && !context.client.added) {
         return (
           <Button
             variant="ghost"
             size="sm"
             onClick={handleAddFrame}
             className="text-[var(--app-accent)] p-4"
           >
             <Icon name="plus" size="sm" />
             Save Frame
           </Button>
         );
       }
   
       if (frameAdded) {
         return (
           <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
             <Icon name="check" size="sm" className="text-[#0052FF]" />
             <span>Saved</span>
           </div>
         );
       }
   
       return null;
     }, [context, frameAdded, handleAddFrame]);
  // Mock end times (24 hours from now)
  const haikuEndTime = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const votingEndTime = new Date(Date.now() + 18 * 60 * 60 * 1000) // 18 hours for demo

  // Function to count syllables (simplified)
  const countSyllables = (text: string): number => {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z]/g, "")
        .match(/[aeiouy]+/g)?.length || 1
    )
  }

  // Mock data
  const incompleteHaiku: HaikuLine[] = [
    {
      text: "Cherry blossoms fall",
      author: "@sakura_poet",
      avatar: "/placeholder.svg?height=32&width=32",
      syllables: 5,
    },
    {
      text: "Gentle spring breeze whispers soft",
      author: "@wind_walker",
      avatar: "/placeholder.svg?height=32&width=32",
      syllables: 7,
    },
  ]

  const completedHaiku: HaikuLine[] = [
    { text: "Cherry blossoms fall", author: "@sakura_poet", syllables: 5 },
    { text: "Gentle spring breeze whispers", author: "@wind_walker", syllables: 7 },
    { text: "Nature's soft embrace", author: "@zen_master", syllables: 5 },
  ]

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
  
  ]

  // Replace leaderboardUsers with topHaiku data
  const topHaiku = [
    {
      id: "h1",
      rank: 1,
      lines: [
        { text: "Morning dew glistens", author: "@dawn_writer", avatar: "/placeholder.svg?height=32&width=32" },
        { text: "On petals soft and tender", author: "@flower_child", avatar: "/placeholder.svg?height=32&width=32" },
        { text: "Sun breaks through the mist", author: "@light_seeker", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 156,
      streak: 7, // Days at #1
      dateCreated: "3 days ago",
    },
    {
      id: "h2",
      rank: 2,
      lines: [
        { text: "Cherry blossoms fall", author: "@sakura_poet", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Gentle spring breeze whispers",
          author: "@wind_walker",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Nature's soft embrace", author: "@zen_master", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 142,
      streak: 3, // Days at #2
      dateCreated: "5 days ago",
    },
    {
      id: "h3",
      rank: 3,
      lines: [
        { text: "Ocean waves retreat", author: "@sea_dreamer", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Leaving shells upon the shore",
          author: "@beach_walker",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Memories remain", author: "@soul_keeper", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 128,
      streak: 12, // Days at #3
      dateCreated: "1 week ago",
    },
    {
      id: "h4",
      rank: 4,
      lines: [
        { text: "Autumn leaves dancing", author: "@fall_lover", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Whispers of the changing time",
          author: "@time_keeper",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Golden moments fade", author: "@moment_catcher", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 115,
      dateCreated: "2 weeks ago",
    },
    {
      id: "h5",
      rank: 5,
      lines: [
        { text: "Silent mountain peak", author: "@peak_climber", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Clouds embrace ancient wisdom",
          author: "@cloud_watcher",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Stillness speaks volumes", author: "@silence_keeper", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 98,
      dateCreated: "2 weeks ago",
    },
    {
      id: "h6",
      rank: 6,
      lines: [
        { text: "Moonlight on water", author: "@moon_gazer", avatar: "/placeholder.svg?height=32&width=32" },
        { text: "Ripples carry silver dreams", author: "@dream_weaver", avatar: "/placeholder.svg?height=32&width=32" },
        { text: "Night's gentle lullaby", author: "@night_singer", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 87,
      dateCreated: "3 weeks ago",
    },
    {
      id: "h7",
      rank: 7,
      lines: [
        { text: "Winter's first snowflake", author: "@snow_dancer", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Delicate crystal messenger",
          author: "@crystal_keeper",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Silence blankets earth", author: "@earth_listener", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 76,
      dateCreated: "1 month ago",
    },
    {
      id: "h8",
      rank: 8,
      lines: [
        { text: "Thunder rolls distant", author: "@storm_chaser", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Lightning paints the darkened sky",
          author: "@sky_painter",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Rain begins to fall", author: "@rain_caller", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 69,
      dateCreated: "1 month ago",
    },
    {
      id: "h9",
      rank: 9,
      lines: [
        { text: "Butterfly emerges", author: "@wing_watcher", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "From cocoon of patient dreams",
          author: "@dream_tender",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Transformation blooms", author: "@bloom_keeper", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 63,
      dateCreated: "1 month ago",
    },
    {
      id: "h10",
      rank: 10,
      lines: [
        { text: "Ancient tree stands tall", author: "@tree_guardian", avatar: "/placeholder.svg?height=32&width=32" },
        {
          text: "Roots deep in earth's memory",
          author: "@memory_keeper",
          avatar: "/placeholder.svg?height=32&width=32",
        },
        { text: "Wisdom in each ring", author: "@ring_reader", avatar: "/placeholder.svg?height=32&width=32" },
      ],
      totalVotes: 58,
      dateCreated: "1 month ago",
    },
  ]

  const userProfile: UserProfile = {
    id: "1",
    username: "@zen_master",
    avatar: "/placeholder.svg?height=80&width=80",
    joinDate: "March 2024",
    totalVotes: 156,
    totalContributions: 23,
    rank: 1,
    contributions: [
      {
        id: "h1",
        haikuLines: ["Morning dew glistens", "On petals soft and tender", "Sun breaks through the mist"],
        myLine: "Sun breaks through the mist",
        linePosition: 3,
        votes: 45,
        date: "2 days ago",
        collaborators: ["@dawn_writer", "@flower_child"],
        isTopVoted: true,
      },
      {
        id: "h2",
        haikuLines: ["Autumn leaves falling", "Whispers of the changing time", "Nature's gentle song"],
        myLine: "Nature's gentle song",
        linePosition: 3,
        votes: 32,
        date: "5 days ago",
        collaborators: ["@fall_lover", "@time_keeper"],
      },
    ],
  }

  const handleSubmitLine = () => {
    if (newLine.trim()) {
      setNewLine("")
      setIsModalOpen(false)
    }
  }

  const handleVote = (haikuId: string) => {
    if (!votedHaikus.has(haikuId)) {
      setVotedHaikus((prev) => new Set([...prev, haikuId]))
      console.log(`Voted for haiku ${haikuId}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleShareToFarcaster = (haiku: any) => {
    const haikuText = haiku.haikuLines.join("\n")
    const shareText = `🌸 Beautiful haiku with ${haiku.votes} votes:\n\n${haikuText}\n\nCreated collaboratively on Haiku app`
    console.log("Sharing to Farcaster:", shareText)
  }

  const getNextLineType = () => {
    const lineNumber = incompleteHaiku.length + 1
    const syllableCount = lineNumber === 1 ? 5 : lineNumber === 2 ? 7 : 5
    return { lineNumber, syllableCount }
  }

  const renderTodayHaiku = () => {
    const { lineNumber, syllableCount } = getNextLineType()
    const isComplete = incompleteHaiku.length === 3

    return (
      <div className="space-y-4 font-poppins">
        {/* Timer */}
        <CountdownTimer endTime={haikuEndTime} label="Haiku closes in" />

        {/* Progress Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Today&apos;s Progress</h2>
            <div className="flex space-x-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    step <= incompleteHaiku.length ? "bg-gradient-to-r from-violet-500 to-purple-500" : "bg-slate-200"
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
          {incompleteHaiku.map((line, index) => (
            <div key={index} className="relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start space-x-3">
                <Avatar className="w-10 h-10 ring-2 ring-violet-100">
                  <AvatarImage src={line.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white text-sm">
                    {line.author.slice(1, 3).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-700 text-sm truncate">{line.author}</span>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          line.syllables === (index === 1 ? 7 : 5)
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {line.syllables} syllables
                      </Badge>
                    </div>
                  </div>
                  <p className="font-serif text-lg text-slate-800 leading-relaxed">{line.text}</p>
                </div>
              </div>
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-7 h-7 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                {index + 1}
              </div>
            </div>
          ))}

          {/* Next Line Placeholder */}
          {!isComplete && (
            <div className="relative bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-4 border-2 border-dashed border-violet-200">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto">
                  <PenTool className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-slate-700">Line {lineNumber} awaits</p>
                  <p className="text-sm text-slate-500">{syllableCount} syllables needed</p>
                </div>
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
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Contribute Line {lineNumber}
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 rounded-2xl max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-center font-semibold text-slate-800">
                  Add Line {lineNumber} ({syllableCount} syllables)
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-sm font-medium text-slate-600 mb-2">Current haiku:</p>
                  {incompleteHaiku.map((line, index) => (
                    <p key={index} className="font-serif text-slate-700 italic text-sm">
                      {line.text}
                    </p>
                  ))}
                </div>
                <Textarea
                  placeholder={`Enter your ${syllableCount}-syllable line...`}
                  value={newLine}
                  onChange={(e) => setNewLine(e.target.value)}
                  className="resize-none border-violet-200 focus:border-violet-400 rounded-xl font-serif"
                  rows={3}
                />
                <div className="flex items-center justify-between text-sm bg-slate-50 rounded-xl p-3">
                  <span className="text-slate-600">
                    Syllables: {newLine ? countSyllables(newLine) : 0}/{syllableCount}
                  </span>
                  <span
                    className={`${
                      newLine && countSyllables(newLine) === syllableCount ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {newLine && countSyllables(newLine) === syllableCount ? "Perfect!" : "Keep going..."}
                  </span>
                </div>
                <Button
                  onClick={handleSubmitLine}
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 rounded-xl py-3"
                  disabled={!newLine.trim() || countSyllables(newLine) !== syllableCount}
                >
                  Submit Line
                </Button>
              </div>
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
                  <h3 className="text-2xl font-semibold text-slate-800">Today&apos;s Completed Haiku</h3>
                  <p className="text-sm text-slate-500">A collaborative masterpiece</p>
                </div>

                <div className="bg-white/60 rounded-2xl p-6 space-y-4">
                  {completedHaiku.map((line, index) => (
                    <div key={index} className="space-y-2">
                      <p className="font-serif text-2xl text-slate-800 leading-relaxed font-medium">{line.text}</p>
                      <div className="flex items-center justify-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src="/placeholder.svg?height=24&width=24" />
                          <AvatarFallback className="bg-emerald-200 text-emerald-700 text-xs">
                            {line.author.slice(1, 3).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm text-slate-600 font-medium">{line.author}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center space-y-3">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-full px-6 py-3 text-sm font-medium">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Submitted onchain
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

  const renderVoting = () => (
    <div className="space-y-4">
      {/* Timer */}
      <CountdownTimer endTime={votingEndTime} label="Voting closes in" />

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-slate-800">Vote for Yesterday&apos;s Best</h2>
        <p className="text-slate-600">Choose your favorite collaborative haiku</p>
      </div>

      <div className="space-y-4">
        {votingHaikus.map((haiku) => {
          const hasVoted = votedHaikus.has(haiku.id)
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
                    disabled={hasVoted}
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
          )
        })}
      </div>

      <div className="text-center text-slate-500 bg-slate-50 p-4 rounded-2xl">
        <Vote className="w-4 h-4 inline mr-2 text-slate-400" />
        <span className="text-sm">Votes are stored onchain — one vote per haiku, non-reversible</span>
      </div>
    </div>
  )

  const renderProfile = () => (
    <div className="space-y-4">
      {/* Profile Header */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 rounded-2xl">
        <CardContent className="p-4 text-center">
          <Avatar className="w-20 h-20 mx-auto mb-4 ring-4 ring-indigo-100">
            <AvatarImage src={userProfile.avatar || "/placeholder.svg"} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xl">
              {userProfile.username.slice(1, 3).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h2 className="text-xl font-semibold text-slate-800 mb-1">{userProfile.username}</h2>
          <p className="text-sm text-slate-500 mb-6">Joined {userProfile.joinDate}</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3">
              <p className="text-2xl font-bold text-indigo-600">#{userProfile.rank}</p>
              <p className="text-xs text-slate-500">Rank</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-2xl font-bold text-rose-500">{userProfile.totalVotes}</p>
              <p className="text-xs text-slate-500">Votes</p>
            </div>
            <div className="bg-white rounded-xl p-3">
              <p className="text-2xl font-bold text-emerald-500">{userProfile.totalContributions}</p>
              <p className="text-xs text-slate-500">Haiku</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contributions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">Your Contributions</h3>
        {userProfile.contributions.map((contribution) => (
          <Card key={contribution.id} className="bg-white border border-slate-200 rounded-2xl">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  {contribution.haikuLines.map((line, index) => (
                    <p
                      key={index}
                      className={`font-serif text-base leading-relaxed ${
                        index === contribution.linePosition - 1
                          ? "text-indigo-700 font-semibold bg-indigo-50 px-3 py-1 rounded-xl"
                          : "text-slate-600"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">
                      Line {contribution.linePosition} • {contribution.date}
                    </p>
                    <p className="text-xs text-slate-500">With {contribution.collaborators.join(", ")}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold text-slate-700">{contribution.votes}</span>
                  </div>
                </div>

                {/* Share Button - Column Layout */}
                {contribution.isTopVoted && (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-3">
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">Top voted haiku!</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleShareToFarcaster(contribution)}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl py-2"
                    >
                      <Share className="w-4 h-4 mr-2" />
                      Share on Farcaster
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // Replace the renderLeaderboard function
  const renderLeaderboard = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-slate-800">Top Haiku</h2>
        <p className="text-slate-600">Most voted collaborative poems of all time</p>
      </div>

      <div className="space-y-4">
        {topHaiku.map((haiku, index) => (
          <Card
            key={haiku.id}
            className={`transition-all duration-300 rounded-3xl border-2 ${
              index === 0
                ? "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300 shadow-lg"
                : index === 1
                  ? "bg-gradient-to-br from-slate-50 to-gray-50 border-slate-300 shadow-md"
                  : index === 2
                    ? "bg-gradient-to-br from-orange-50 to-red-50 border-orange-300 shadow-md"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md"
            }`}
          >
            <CardContent className="p-4">
              {/* Header with Rank and Stats */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg ${
                      index === 0
                        ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white"
                        : index === 1
                          ? "bg-gradient-to-r from-slate-500 to-gray-500 text-white"
                          : index === 2
                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                            : "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                    }`}
                  >
                    #{haiku.rank}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Heart className="w-5 h-5 text-rose-500" />
                        <span className="text-xl font-bold text-slate-800">{haiku.totalVotes}</span>
                        <span className="text-sm text-slate-500">votes</span>
                      </div>
                      {haiku.streak && index < 3 && (
                        <div className="flex items-center space-x-1 bg-orange-100 border border-orange-200 text-orange-700 px-3 py-1 rounded-full">
                          <Flame className="w-4 h-4" />
                          <span className="text-sm font-bold">{haiku.streak} days</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{haiku.dateCreated}</p>
                  </div>
                </div>
              </div>

              {/* Haiku Lines */}
              <div className="space-y-3 mb-6">
                {haiku.lines.map((line, lineIndex) => (
                  <div key={lineIndex} className="relative">
                    <div className="bg-white/80 rounded-2xl p-3 border border-white/50">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mb-2">
                            {lineIndex + 1}
                          </div>
                          <Avatar className="w-8 h-8 ring-2 ring-white shadow-sm">
                            <AvatarImage src={line.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-400 text-white text-xs">
                              {line.author.slice(1, 3).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-lg text-slate-800 leading-relaxed mb-2">{line.text}</p>
                          <p className="text-sm font-medium text-slate-600">{line.author}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer with Streak Info */}
              {haiku.streak && index < 3 && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3">
                  <div className="flex items-center justify-center space-x-2">
                    <Trophy className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">
                      {haiku.streak} consecutive days in top {index + 1}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-slate-500 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 p-6 rounded-3xl">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Trophy className="w-5 h-5 text-violet-600" />
          <span className="font-semibold text-violet-800">Hall of Fame</span>
        </div>
        <p className="text-sm">Rankings updated daily • Celebrating collaborative poetry excellence</p>
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
                {/* <p className="text-xs text-slate-500 -mt-1">Collaborative Poetry</p> */}
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

              {/* {isWalletConnected ? (
                <Avatar className="w-8 h-8 ring-2 ring-violet-200">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" />
                  <AvatarFallback className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs">
                    ZM
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsWalletConnected(true)}
                  className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl px-4 py-1 text-sm"
                >
                  <Wallet className="w-4 h-4 mr-1" />
                  Connect
                </Button>
              )} */}
              <div className="flex items-center space-x-2">
              <Wallet className="z-10">
                <ConnectWallet className="py-1">
                  <Name className="text-inherit" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
             <div>{saveFrameButton}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-[48px] bg-white/90 backdrop-blur-md  ">
        <div className="border-b border-slate-300">
          <div className="flex max-w-sm mx-auto px-4 ">
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
