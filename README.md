# SWR — Saudi Real World Assets Platform

Tokenizing Saudi Arabia's real-world assets on a regulated, Shariah-compliant blockchain.

## Vision
Give every Saudi investor access to institutional-grade assets — real estate, sukuk, infrastructure — starting from SAR 100, with on-chain yield distribution and 24/7 secondary trading.

## Stack

| Layer | Technology |
|---|---|
| Blockchain | Cosmos SDK (EVM-compatible via Ethermint) |
| Smart Contracts | Solidity (ERC-1400 security tokens) |
| Frontend | HTML/CSS/JS → React (Phase 2) |
| Wallet | WalletConnect + custom Freehold Wallet |
| Stablecoin | SARX (SAR-pegged, SAMA-compliant) |
| Compliance | On-chain KYC whitelist + Chainalysis |

## Tokens

- **$SWR** — Platform utility & governance token (200M fixed supply)
- **$xASSET** — Per-asset security tokens (e.g. $xROSHN1, $xGOLD)
- **$SARX** — SAR-pegged stablecoin for settlement

## Project Structure

```
swr/
├── web/              # Landing page + investor portal
│   ├── index.html    # English landing page
│   └── index-ar.html # Arabic landing page
├── contracts/        # Solidity smart contracts
│   ├── SWRToken.sol         # Utility token
│   ├── AssetToken.sol       # Security token (ERC-1400)
│   ├── KYCWhitelist.sol     # On-chain compliance
│   └── YieldDistributor.sol # Automated yield distribution
├── docs/             # Whitepaper, legal, architecture
│   └── whitepaper.md
└── api/              # Backend API (Node.js)
```

## Regulatory Target
- Saudi CMA Fintech Lab sandbox — Q1 2026
- SAMA Regulatory Sandbox ($SARX) — Q2 2026
- Full CMA CMI License — Q1 2027

## Founders
- [CEO] — Saudi institutional finance + regulatory
- [CTO] — Blockchain / Cosmos SDK
- [CLO] — CMA / SAMA securities law

---
*Confidential — For internal development use only.*
