import { useAccount } from "wagmi";
import { useCapabilities } from "wagmi/experimental";
import { useMemo } from "react";
import { haikuABI, haikuAddress } from "../../ABIs/haiku";
import { TransactButton } from "./TransactButton";

export function TransactWithPaymaster() {
  const account = useAccount();
  const { data: availableCapabilities } = useCapabilities({
    account: account.address,
  });
  const capabilities = useMemo(() => {
    if (!availableCapabilities || !account.chainId) return;
    const capabilitiesForChain = availableCapabilities[account.chainId];
    if (
      capabilitiesForChain["paymasterService"] &&
      capabilitiesForChain["paymasterService"].supported
    ) {
      const paymasterServiceUrl = process.env.NEXT_PUBLIC_PAYMASTER_PROXY_SERVER_URL
      return {
        paymasterService: {
          url: paymasterServiceUrl,
        },
      };
    }
  }, [availableCapabilities, account.chainId]);

  return (
    <div>
      <h2>Transact With Paymaster</h2>
      <div>
        <TransactButton
          text="Mint"
          contracts={[
            {
              address: haikuAddress,
              abi: haikuABI,
              functionName: "safeMint",
              args: [account.address],
            },
          ]}
          capabilities={capabilities}
        />
      </div>
    </div>
  );
}