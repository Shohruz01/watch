import { useEffect, useState } from "react";
import { ethers } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";

import "./App.css";
import WATCH_ABI from "./abi/WATCH.json";

import {
  CONTRACT_ADDRESS,
  CHAIN_ID,
  MINT_PRICE,
  MAX_SUPPLY,
} from "./config";

const NFTs = [
  { id: 1, image: "/nfts/WATCH-1.svg" },
  { id: 2, image: "/nfts/WATCH-2.svg" },
  { id: 3, image: "/nfts/WATCH-3.svg" },
  { id: 4, image: "/nfts/WATCH-4.svg" },
  { id: 5, image: "/nfts/WATCH-5.svg" },
];

const OPENSEA_URL =
  `https://opensea.io/item/base/${CONTRACT_ADDRESS.toLowerCase()}/1`;

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

let wcProvider = null;

async function getWalletConnectProvider() {
  if (wcProvider) return wcProvider;

  if (!PROJECT_ID) {
    throw new Error("WalletConnect Project ID is missing.");
  }

  wcProvider = await EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [Number(CHAIN_ID)],
    optionalChains: [Number(CHAIN_ID)],
    showQrModal: true,
    metadata: {
      name: "WATCH",
      description: "WATCH — Luxury Digital Timepieces",
      url: window.location.origin,
      icons: [`${window.location.origin}/nfts/WATCH-1.svg`],
    },
  });

  return wcProvider;
}

function App() {
  const [current, setCurrent] = useState(0);
  const [account, setAccount] = useState("");
  const [minted, setMinted] = useState(0);
  const [minting, setMinting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(null);
  const [mintPrice, setMintPrice] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % NFTs.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  async function loadMinted(providerOverride = null) {
    try {
      const provider =
        providerOverride ||
        wcProvider ||
        window.ethereum;

      if (!provider) return;

      const ethersProvider = new ethers.BrowserProvider(provider);

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        WATCH_ABI,
        ethersProvider
      );

      const total = await contract.totalMinted();
      setMinted(Number(total));
    } catch (err) {
      console.error("loadMinted error:", err);
    }
  }

  async function loadWalletInfo(providerOverride = null, wallet = null) {
    try {
      const provider =
        providerOverride ||
        wcProvider ||
        window.ethereum;

      if (!provider || !wallet) return;

      const ethersProvider = new ethers.BrowserProvider(provider);

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        WATCH_ABI,
        ethersProvider
      );

      const [walletBalance, realMintPrice] =
        await Promise.all([
          ethersProvider.getBalance(wallet),
          contract.mintPrice(),
        ]);

      setBalance(walletBalance);
      setMintPrice(realMintPrice);
    } catch (err) {
      console.error("loadWalletInfo error:", err);
    }
  }

  async function connectWallet() {
    if (connecting) return;

    setConnecting(true);
    setError("");

    try {
      const provider =
        await getWalletConnectProvider();

      await provider.connect();

      const ethersProvider =
        new ethers.BrowserProvider(provider);

      const network =
        await ethersProvider.getNetwork();

      if (
        Number(network.chainId) !==
        Number(CHAIN_ID)
      ) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          });
        } catch (switchError) {
          console.error(
            "Network switch error:",
            switchError
          );

          throw new Error(
            "Please switch your wallet to Base Mainnet."
          );
        }
      }

      const accounts =
        await provider.request({
          method: "eth_accounts",
        });

      if (
        !accounts ||
        accounts.length === 0
      ) {
        throw new Error(
          "No wallet account was found."
        );
      }

      const wallet = accounts[0];

      setAccount(wallet);

      await loadMinted(provider);
      await loadWalletInfo(
        provider,
        wallet
      );

      provider.on(
        "accountsChanged",
        async (accountsChanged) => {
          if (
            !accountsChanged ||
            accountsChanged.length === 0
          ) {
            setAccount("");
            setBalance(null);
            setMintPrice(null);
            return;
          }

          const newAccount =
            accountsChanged[0];

          setAccount(newAccount);

          await loadWalletInfo(
            provider,
            newAccount
          );
        }
      );

      provider.on(
        "chainChanged",
        async (chainId) => {
          const numericChainId =
            parseInt(chainId, 16);

          if (
            numericChainId !==
            Number(CHAIN_ID)
          ) {
            setError(
              "Please switch your wallet to Base Mainnet."
            );
          } else {
            setError("");

            await loadMinted(provider);

            const accountsNow =
              await provider.request({
                method: "eth_accounts",
              });

            if (accountsNow?.[0]) {
              await loadWalletInfo(
                provider,
                accountsNow[0]
              );
            }
          }
        }
      );
    } catch (err) {
      console.error(
        "Connect error:",
        err
      );

      setError(
        err?.shortMessage ||
          err?.message ||
          "Wallet connection failed."
      );
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectWallet() {
    try {
      if (wcProvider) {
        await wcProvider.disconnect();
      }
    } catch (err) {
      console.error(
        "Disconnect error:",
        err
      );
    }

    setAccount("");
    setBalance(null);
    setMintPrice(null);
    setError("");
  }

  async function mint() {
    if (!account) {
      await connectWallet();
      return;
    }

    setMinting(true);
    setError("");

    try {
      if (!wcProvider) {
        throw new Error(
          "Wallet is not connected."
        );
      }

      const ethersProvider =
        new ethers.BrowserProvider(
          wcProvider
        );

      const network =
        await ethersProvider.getNetwork();

      if (
        Number(network.chainId) !==
        Number(CHAIN_ID)
      ) {
        throw new Error(
          "Please switch your wallet to Base Mainnet."
        );
      }

      const signer =
        await ethersProvider.getSigner();

      const walletAddress =
        await signer.getAddress();

      const readContract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          WATCH_ABI,
          ethersProvider
        );

      const contract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          WATCH_ABI,
          signer
        );

      const [
        walletBalance,
        realMintPrice,
        mintOpen,
        totalMinted,
        maxSupply,
      ] = await Promise.all([
        ethersProvider.getBalance(
          walletAddress
        ),
        readContract.mintPrice(),
        readContract.mintOpen(),
        readContract.totalMinted(),
        readContract.MAX_SUPPLY(),
      ]);

      if (!mintOpen) {
        throw new Error(
          "Mint is currently closed."
        );
      }

      if (
        BigInt(totalMinted) >=
        BigInt(maxSupply)
      ) {
        throw new Error(
          "All WATCH NFTs have been minted."
        );
      }

      if (
        walletBalance <
        realMintPrice
      ) {
        const currentBalance =
          ethers.formatEther(
            walletBalance
          );

        const requiredBalance =
          ethers.formatEther(
            realMintPrice
          );

        const missingBalance =
          ethers.formatEther(
            realMintPrice -
              walletBalance
          );

        throw new Error(
          `Insufficient ETH. You have ${currentBalance} ETH. Mint requires ${requiredBalance} ETH plus gas. You need at least ${missingBalance} ETH more, plus gas.`
        );
      }

      try {
        await contract.mint.estimateGas(
          1,
          {
            value: realMintPrice,
          }
        );
      } catch (estimateError) {
        console.error(
          "Mint gas estimation failed:",
          estimateError
        );

        const rpcMessage =
          estimateError?.info?.error
            ?.message ||
          estimateError?.shortMessage ||
          estimateError?.reason ||
          "";

        const lowerMessage =
          rpcMessage.toLowerCase();

        if (
          lowerMessage.includes(
            "outoffunds"
          ) ||
          lowerMessage.includes(
            "insufficient"
          )
        ) {
          throw new Error(
            `Insufficient ETH for mint + gas. Your balance is ${ethers.formatEther(
              walletBalance
            )} ETH.`
          );
        }

        throw new Error(
          `Mint transaction cannot be simulated: ${
            rpcMessage ||
            "unknown contract error"
          }`
        );
      }

      const tx =
        await contract.mint(1, {
          value: realMintPrice,
        });

      setError(
        `Transaction submitted: ${tx.hash}`
      );

      await tx.wait();

      await loadMinted(wcProvider);

      await loadWalletInfo(
        wcProvider,
        walletAddress
      );

      setError("");

      alert(
        "WATCH successfully minted!"
      );
    } catch (err) {
      console.error(
        "Mint error:",
        err
      );

      setError(
        err?.shortMessage ||
          err?.reason ||
          err?.message ||
          "Mint failed."
      );
    } finally {
      setMinting(false);
    }
  }

  const shortAccount = account
    ? `${account.slice(
        0,
        6
      )}...${account.slice(-4)}`
    : "";

  const displayBalance =
    balance !== null
      ? Number(
          ethers.formatEther(
            balance
          )
        ).toFixed(4)
      : null;

  const displayMintPrice =
    mintPrice !== null
      ? Number(
          ethers.formatEther(
            mintPrice
          )
        ).toFixed(4)
      : Number(
          MINT_PRICE
        ).toFixed(4);

  return (
    <div className="watch-app">

      {/* NAVBAR */}
      <header className="navbar">

        <a
          href="#top"
          className="brand"
        >
          <span className="brand-mark">
            W
          </span>

          <span className="brand-name">
            WATCH
          </span>
        </a>

        <nav className="nav-links">
          <a href="#collection">
            Collection
          </a>

          <a href="#story">
            Story
          </a>

          <a
            href={OPENSEA_URL}
            target="_blank"
            rel="noreferrer"
          >
            OpenSea ↗
          </a>
        </nav>

        {!account ? (
          <button
            className="wallet-button"
            onClick={connectWallet}
            disabled={connecting}
          >
            <span className="wallet-dot" />
            {connecting
              ? "CONNECTING..."
              : "CONNECT WALLET"}
          </button>
        ) : (
          <button
            className="wallet-button connected"
            onClick={disconnectWallet}
          >
            <span className="wallet-dot" />
            {shortAccount}
          </button>
        )}

      </header>

      {/* MESSAGE */}
      {error && (
        <div className="message-wrap">
          <div className="wallet-message">
            <span>!</span>
            <p>{error}</p>
            <button
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* HERO */}
      <main id="top">

        <section className="hero">

          <div className="hero-copy">

            <div className="hero-label">
              <span />
              FULLY ON-CHAIN DIGITAL TIMEPIECES
            </div>

            <h1>
              TIME
              <br />
              <em>REIMAGINED.</em>
            </h1>

            <p className="hero-text">
              WATCH is a collection of
              digital timepieces created
              for the blockchain era.
              Designed with precision.
              Built to exist forever on-chain.
            </p>

            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={mint}
                disabled={
                  minting ||
                  connecting
                }
              >
                <span>
                  {minting
                    ? "MINTING..."
                    : "MINT WATCH"}
                </span>

                <strong>
                  {displayMintPrice} ETH
                </strong>
              </button>

               <a
  href="https://opensea.io/collection/watchsis"
  target="_blank"
  rel="noopener noreferrer"
  className="outline-button"
>
  View Collection
  <span>↗</span>
</a>

            </div>

            {account && (
              <div className="wallet-panel">

                <div className="wallet-panel-top">
                  <span>
                    CONNECTED WALLET
                  </span>

                  <b>
                    BASE
                  </b>
                </div>

                <div className="wallet-address">
                  {account}
                </div>

                <div className="wallet-details">

                  <div>
                    <small>
                      BALANCE
                    </small>
                    <strong>
                      {displayBalance} ETH
                    </strong>
                  </div>

                  <div>
                    <small>
                      MINT PRICE
                    </small>
                    <strong>
                      {displayMintPrice} ETH
                    </strong>
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* WATCH ART */}
          <div className="hero-visual">

            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />

            <div className="visual-caption">
              <span>
                01 / 05
              </span>

              <span>
                WATCH
              </span>
            </div>

            <div className="watch-card">

              <div className="card-top">
                <span>
                  WATCH
                </span>

                <span>
                  #{String(
                    NFTs[current].id
                  ).padStart(3, "0")}
                </span>
              </div>

              <div className="watch-image">
                <img
                  key={NFTs[current].id}
                  src={NFTs[current].image}
                  alt={`WATCH #${NFTs[current].id}`}
                />
              </div>

              <div className="card-bottom">

                <span>
                  DIGITAL
                  <br />
                  TIMEPIECE
                </span>

                <span>
                  BASE
                  <br />
                  8453
                </span>

              </div>

            </div>

            <div className="slider-dots">
              {NFTs.map(
                (nft, index) => (
                  <button
                    key={nft.id}
                    className={
                      index === current
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setCurrent(index)
                    }
                    aria-label={`Show WATCH ${nft.id}`}
                  />
                )
              )}
            </div>

          </div>

        </section>

        {/* STATS */}
        <section className="stats-section">

          <div className="stat-item">
            <strong>
              {String(
                minted
              ).padStart(2, "0")}
            </strong>
            <span>
              MINTED
            </span>
          </div>

          <div className="stat-line" />

          <div className="stat-item">
            <strong>
              {MAX_SUPPLY.toLocaleString()}
            </strong>
            <span>
              TOTAL SUPPLY
            </span>
          </div>

          <div className="stat-line" />

          <div className="stat-item">
            <strong>
              {displayMintPrice}
            </strong>
            <span>
              ETH / WATCH
            </span>
          </div>

          <div className="stat-line" />

          <div className="stat-item">
            <strong>
              BASE
            </strong>
            <span>
              NETWORK
            </span>
          </div>

        </section>

        {/* COLLECTION */}
        <section
          id="collection"
          className="collection-section"
        >

          <div className="section-intro">

            <div>
              <div className="eyebrow">
                THE COLLECTION
              </div>

              <h2>
                A NEW
                <br />
                <em>STANDARD OF TIME.</em>
              </h2>
            </div>

            <p>
              Five preview pieces from
              the WATCH universe.
              Every timepiece is designed
              as a unique digital object
              living on Base.
            </p>

          </div>

          <div className="collection-grid">

            {NFTs.map(
              (nft, index) => (
                <button
                  className={
                    `collection-card ${
                      index === current
                        ? "selected"
                        : ""
                    }`
                  }
                  key={nft.id}
                  onClick={() =>
                    setCurrent(index)
                  }
                >

                  <div className="collection-number">
                    {String(
                      nft.id
                    ).padStart(2, "0")}
                  </div>

                  <img
                    src={nft.image}
                    alt={`WATCH #${nft.id}`}
                  />

                  <div className="collection-card-bottom">
                    <span>
                      WATCH
                    </span>

                    <strong>
                      #{String(
                        nft.id
                      ).padStart(3, "0")}
                    </strong>
                  </div>

                </button>
              )
            )}

          </div>

        </section>

        {/* STORY */}
        <section
          id="story"
          className="story-section"
        >

          <div className="story-number">
            01
          </div>

          <div className="story-content">

            <div className="eyebrow">
              THE WATCH PHILOSOPHY
            </div>

            <h2>
              TIME SHOULD
              <br />
              <em>LIVE FOREVER.</em>
            </h2>

            <p>
              Physical watches measure time.
              WATCH turns time into a digital
              collectible designed for the
              blockchain generation.
            </p>

            <p>
              Built on Base, each WATCH is
              created to become a permanent
              piece of digital culture.
            </p>

            <div className="story-signature">
              <span />
              WATCH / BASE
            </div>

          </div>

        </section>

        {/* MINT CTA */}
        <section className="mint-section">

          <div className="mint-glow" />

          <div className="eyebrow">
            THE NEXT TIMEPIECE
          </div>

          <h2>
            OWN A PIECE
            <br />
            <em>OF TIME.</em>
          </h2>

          <p>
            Mint your WATCH directly
            on Base.
          </p>

          <button
            className="large-mint-button"
            onClick={mint}
            disabled={
              minting ||
              connecting
            }
          >
            {minting
              ? "MINTING..."
              : `MINT WATCH — ${displayMintPrice} ETH`}
            <span>→</span>
          </button>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="footer">

        <div className="footer-brand">
          <span className="brand-mark">
            W
          </span>

          <span>
            WATCH
          </span>
        </div>

        <div className="footer-center">
          FULLY ON-CHAIN
          <span>•</span>
          BUILT ON BASE
        </div>

        <div className="footer-right">
          <a
            href={OPENSEA_URL}
            target="_blank"
            rel="noreferrer"
          >
            OPENSEA ↗
          </a>

          <span>
            © {new Date().getFullYear()}
          </span>
        </div>

      </footer>

    </div>
  );
}

export default App;
