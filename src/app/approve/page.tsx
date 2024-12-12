"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Web3 from "web3";
import Image from "next/image";
import MULTISENDER_ABI from './ABI.json';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface ValidAddress {
  address: string;
  amount: string;
}

interface InvalidAddress {
  address?: string;
  amount?: string;
}

export default function Approve() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ApproveContent />
    </Suspense>
  );
}

function ApproveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [validAddresses, setValidAddresses] = useState<ValidAddress[]>([]);
  const [invalidAddresses, setInvalidAddresses] = useState<InvalidAddress[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [status, setStatus] = useState<"Prepare" | "Approve" | "Multisend">("Prepare");
  const [totalETH, setTotalETH] = useState<number>(0);
  const [accountETH, setAccountETH] = useState<number>(0);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");
  const [insufficientETH, setInsufficientETH] = useState<boolean>(false);

  const MULTISENDER_CONTRACT_ADDRESS = "0x86889B10376dB115763050eba1Ed20b1d4Eb0fd3";

  useEffect(() => {
    if (!searchParams) return;

    const validData = searchParams.get("validAddresses");
    const invalidData = searchParams.get("invalidAddresses");
    const tokenData = searchParams.get("selectedToken");

    if (validData) setValidAddresses(JSON.parse(validData));
    if (invalidData) setInvalidAddresses(JSON.parse(invalidData));
    if (tokenData) setSelectedToken(tokenData);

    if (window.ethereum) {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);

      const fetchAccountInfo = async () => {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          });
          const account = accounts[0];
          setUserAddress(account);

          const balance = await web3Instance.eth.getBalance(account);
          const ethBalance = parseFloat(Web3.utils.fromWei(balance, "ether"));
          setAccountETH(ethBalance);
        } catch (error) {
          console.error("Error fetching account info:", error);
          toast.error("Failed to fetch account information. Please try again.");
        }
      };

      fetchAccountInfo();
    }
  }, [searchParams]);

  useEffect(() => {
    const total = validAddresses.reduce((acc, entry) => acc + parseFloat(entry.amount), 0);
    setTotalETH(total);
    setInsufficientETH(total > accountETH);
  }, [validAddresses, accountETH]);

  const goBack = () => {
    router.push("/");
    toast.info("Navigating back to the previous page.");
  };

const handleMultisendToken = async () => {
    if (!web3) {
      toast.error("Please connect to MetaMask.");
      return;
    }

    const invalidAddressesList = validAddresses.filter(entry => !web3.utils.isAddress(entry.address));
    if (invalidAddressesList.length > 0) {
      toast.error("Some addresses are invalid. Please check and try again.");
      return;
    }

    try {
      const contract = new web3.eth.Contract(MULTISENDER_ABI, MULTISENDER_CONTRACT_ADDRESS);

      const addressesArray = validAddresses.map((entry) => entry.address);
      const amountsArray = validAddresses.map((entry) =>
        Web3.utils.toWei(entry.amount.toString(), "ether")
      );

      const gasEstimate = await contract.methods
        .multisendToken(selectedToken, addressesArray, amountsArray)
        .estimateGas({ from: userAddress });

      const tx = await contract.methods
        .multisendToken(selectedToken, addressesArray, amountsArray)
        .send({ from: userAddress, gas: gasEstimate });

      toast.success("Tokens successfully sent to all recipients!");
      console.log("Transaction successful:", tx);
    } catch (error) {
      console.error("Error during multisend:", error);
      toast.error("Error processing the multisend. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#1e293b] to-[#0F123D] bg-opacity-80 text-white">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <ToastContainer />
        <div className="flex flex-wrap justify-center items-center mb-8">
          <div className="flex items-center space-x-4">
            <Step stepNumber={1} label="Prepare" isActive={status === "Prepare"} />
            <div className="h-6 border-l border-gray-500"></div>
            <Step stepNumber={2} label="Approve" isActive={status === "Approve"} />
            <div className="h-6 border-l border-gray-500"></div>
            <Step stepNumber={3} label="Multisend" isActive={status === "Multisend"} />
          </div>
        </div>

        <div className="border border-blue-900 rounded-xl">
          <div className="bg-gradient-to-r from-[#1e293b] to-[#0F123D] bg-opacity-80 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-xl">
              <div className="text-center border border-blue-700 px-2 py-4 rounded-lg text-blue-500 text-xs">
                <p className="text-xl font-semibold">{totalETH.toFixed(4)} ETH</p>
                <p>Total Token to send</p>
              </div>
              <div className="text-center text-blue-400 border border-blue-700 rounded-xl px-2 py-4 text-xs">
                <p className="text-xl font-semibold">{accountETH.toFixed(4)} ETH</p>
                <p>Your ETH balance</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#1e293b] to-[#0F123D] bg-opacity-80 p-6 rounded-lg text-xs text-blue-400">
            <span className="text-lg font-semibold mb-4">Selected Token</span>
            <p className="text-sm text-gray-400">{selectedToken}</p>

            <h3 className="text-lg font-semibold mb-2 mt-4">Valid Addresses</h3>
            <div className="space-y-2">
            {validAddresses.map((entry, index) => (
            <div key={index} className="flex justify-between items-center">
            <span>{entry.address}</span>
            <span>{`${entry.amount} Token`}</span>
            </div>
            ))}
            </div>
            <h3 className="text-lg font-semibold mt-6 mb-4">Invalid Addresses</h3>
            <div className="space-y-2 text-red-400">
              {invalidAddresses.length > 0 ? (
                invalidAddresses.map((entry, index) => (
                  <RecipientRow key={index} address={entry.address || "Invalid"} amount={entry.amount || "N/A"} />
                ))
              ) : (
                <p className="text-green-500">All addresses are valid!</p>
              )}
            </div>

            {insufficientETH && (
              <div className="bg-red-600 text-white p-4 rounded-lg mt-4">
                <p>
                  Insufficient ETH in your account. You need at least {totalETH.toFixed(4)} ETH to proceed with the
                  transaction.
                </p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <button
                onClick={goBack}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleMultisendToken}   
                disabled={validAddresses.length === 0 || insufficientETH}
                className={`w-full ${
                  validAddresses.length > 0 && !insufficientETH
                    ? "bg-blue-900 hover:bg-blue-800"
                    : "bg-gray-500"
                } text-white py-3 rounded-lg font-semibold`}
              >
                MultisendToken
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  stepNumber: number;
  label: string;
  isActive: boolean;
}

const Step = ({ stepNumber, label, isActive }: StepProps) => (
  <div className={`flex items-center space-x-2 ${isActive ? "text-blue-400" : "text-gray-600"}`}>
    <span className="font-semibold text-xl">{stepNumber}</span>
    <span className="text-sm">{label}</span>
  </div>
);

const RecipientRow = ({ address, amount }: { address: string; amount: string }) => (
  <div className="border border-blue-700 p-2 rounded-lg">
    <p className="font-semibold">{address}</p>
    <p>{amount}</p>
  </div>
);

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center text-white">
      <p>Loading...</p>
    </div>
  );
}
