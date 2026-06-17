# SWR Platform — Technical Whitepaper v0.1 (Draft)

**Saudi Real World Assets · سواعد للأصول الواقعية**  
*Confidential Draft — Not for Distribution*

---

## Abstract

SWR is a regulated Layer-1 blockchain platform for tokenizing, trading, and managing real-world assets within the Kingdom of Saudi Arabia. The platform issues CMA-compliant security tokens ($xASSET) representing fractional ownership of real-world assets — starting with real estate and sukuk — enabling any Saudi investor to participate from SAR 100 with on-chain yield distribution and 24/7 secondary trading.

---

## 1. The Problem

Saudi Arabia's real-world asset market exceeds SAR 2.5 trillion, yet participation requires:

- Minimum investments of SAR 500K–5M for direct real estate
- 30–90 day settlement cycles for property transactions  
- No secondary liquidity for private asset holdings
- Complex legal and intermediary structures
- Manual, quarterly yield distributions
- Geographic restrictions limiting international capital

---

## 2. The Solution

SWR digitizes ownership. Every tokenized asset is:

1. **Legally structured** in a Saudi Special Purpose Vehicle (SPV)
2. **Shariah-certified** by our 3-member Supervisory Board
3. **CMA-compliant** — issued as regulated digital securities
4. **KYC-gated** — only verified investors can hold tokens
5. **Yield-distributing** — SARX payments streamed on-chain

---

## 3. Technical Architecture

### 3.1 Blockchain Layer (Layer 1)

- **Framework**: Cosmos SDK with Ethermint (EVM compatibility)
- **Consensus**: Tendermint BFT (Proof-of-Stake)
- **Finality**: 2-second block time, instant finality
- **Interoperability**: IBC protocol for cross-chain bridges
- **Transaction cost**: < SAR 0.01 per transaction
- **Validator set**: Initially 21 validators; permissioned set includes licensed Saudi entities

### 3.2 Compliance Layer (Layer 2)

```
KYCWhitelist.sol
├── approveInvestor(address, tier, kycHash, jurisdiction, shariahConsent)
├── isWhitelisted(address) → bool
├── getInvestmentLimit(address) → uint256
└── regulatorView(address) → Investor  [REGULATOR_ROLE only]
```

- On-chain identity attestations — KYC hashes stored on-chain, documents off-chain (IPFS + encrypted S3)
- Investor tiers: RETAIL (max SAR 200K), PROFESSIONAL (max SAR 2M), INSTITUTIONAL (unlimited)
- Real-time OFAC/UN sanctions screening via Chainalysis oracle
- 365-day KYC expiry — annual renewal required
- Regulator portal (read-only) for CMA and SAMA authorized examiners

### 3.3 Application Layer (Layer 3)

| Product | Description |
|---|---|
| Issuance Studio | Web portal for asset sponsors to tokenize assets |
| Freehold Wallet | Non-custodial mobile + web wallet (iOS, Android) |
| Secondary Market | KYC-enforced DEX with order book + AMM pools |
| Yield Engine | Automated SARX distribution to token holders |
| Regulator Portal | Read-only compliance dashboard for CMA/SAMA |

---

## 4. Token Architecture

### 4.1 $SWR — Utility Token

- **Type**: ERC-20 (ERC20Votes for governance)
- **Supply**: 200,000,000 SWR (fixed, no mint after deployment)
- **Uses**: Gas fees, validator staking (min 10,000 SWR), governance, 50% fee discount
- **Buyback**: 30% of protocol revenue used quarterly to buy and burn SWR
- **Legal status**: NOT a security — pure utility token

**Allocation:**

| Tranche | % | Vesting |
|---|---|---|
| Community & Ecosystem | 35% | 4-year linear |
| Team & Advisors | 20% | 4-year, 1-year cliff |
| Investors (SAFT) | 18% | 2-year linear |
| Protocol Treasury | 15% | Governance-controlled |
| Staking Rewards | 7% | Released over 10 years |
| Public Sale | 5% | No lock |

### 4.2 $xASSET — Security Tokens

- **Type**: Modified ERC-20 with transfer restrictions (ERC-1400 inspired)
- **Compliance**: Transfer blocked if either party not KYC-whitelisted
- **Decimals**: 6 (1 token = 1/1,000,000 of asset)
- **Yield**: Distributed in $SARX via YieldDistributor.sol
- **Legal backing**: Each token = pro-rata ownership in Saudi SPV
- **Naming**: $x + AssetCode (e.g. $xROSHN1, $xGOLD, $xNEOM1)

### 4.3 $SARX — SAR Stablecoin

- **Peg**: 1 SARX = 1 SAR (maintained 1:1)
- **Collateral**: 100% SAR held in SAMA-licensed custody bank
- **Issuance**: On-chain mint against SAR deposit; burn on redemption
- **Regulatory**: Operating under SAMA Regulatory Sandbox
- **Use cases**: Settlement, yield payments, trading pair on DEX

---

## 5. Asset Tokenization Process

```
Step 1: Asset Sponsor submits asset → SWR Due Diligence
Step 2: Legal team structures Saudi SPV (LLC) for the asset
Step 3: Shariah Board reviews and issues Fatwa certificate
Step 4: CMA approval for digital security issuance
Step 5: Smart contracts deployed: AssetToken + YieldDistributor
Step 6: Tokens issued to Issuance Sponsor (initial holder)
Step 7: Public offering via SWR platform to whitelisted investors
Step 8: Yield collected monthly, distributed on-chain in SARX
```

---

## 6. Smart Contract Security

- 3 independent smart contract audits before mainnet launch
- $3M SAR bug bounty program (ongoing)
- Formal verification of KYCWhitelist and AssetToken core logic
- Staged TVL limits: SAR 10M → SAR 100M → unlimited
- Multisig admin keys (5-of-9) for all protocol upgrades
- 48-hour timelock on all governance-approved upgrades

---

## 7. Regulatory Compliance

| Regulator | License/Framework | Status |
|---|---|---|
| Saudi CMA | Fintech Lab Sandbox | Applying Q1 2026 |
| Saudi CMA | Capital Market Institution | Target Q1 2027 |
| SAMA | Payment Services Sandbox | Applying Q2 2026 |
| SAMA | $SARX Stablecoin Framework | Target Q2 2027 |
| ZATCA | Digital Asset Tax Classification | Engaging Q3 2026 |

---

## 8. Shariah Compliance

SWR operates under a 3-member Shariah Supervisory Board (SSB):

- All asset tokens are asset-backed (no derivatives, no riba)
- Yield from ownership income only (rent, profit-sharing, commodity margin)
- Sukuk token structures follow AAOIFI SS-14 and SS-17
- Annual Shariah audit published publicly
- Investors can filter for Shariah-only assets on the platform

---

## 9. Roadmap

| Phase | Period | Milestones |
|---|---|---|
| Foundation | Q1–Q2 2026 | Legal entity, CMA sandbox application, mainnet testnet, seed round |
| Beta | Q3–Q4 2026 | Private beta 500 investors, 5 anchor assets, $SARX soft launch, Series A |
| Launch | Q1–Q2 2027 | Public launch, 20 assets, secondary market live, SAMA $SARX license |
| Scale | Q3 2027–Q4 2028 | Full CMA license, 60 assets, SAR 3B AUM, 3 bank white-label partners |
| Dominance | 2029–2030 | 300 assets, SAR 15B AUM, 300K investors, Vision 2030 mega-tokenizations |

---

## 10. Team

*[To be completed with founding team profiles]*

---

*This document is a working draft. Version history tracked in git.*  
*SWR Platform · founders@swr.sa · Riyadh, Saudi Arabia*
