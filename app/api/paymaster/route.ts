export async function GET() {
  return new Response(
    JSON.stringify({
      url: process.env.NEXT_PUBLIC_COINBASE_PAYMASTER_URL,
    }),
    { status: 200 }
  );
}