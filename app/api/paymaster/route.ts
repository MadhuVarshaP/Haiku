import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    url: process.env.NEXT_PUBLIC_COINBASE_PAYMASTER_URL,
  });
}
