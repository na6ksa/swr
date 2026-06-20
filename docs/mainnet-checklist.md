# SWR Platform — Pre-Mainnet Checklist

## 1. Smart Contract Security

- [ ] All audit findings from v2 security review resolved (DONE ✅)
- [ ] Third-party audit completed (Trail of Bits / OpenZeppelin / CMA-approved firm)
- [ ] Audit report published publicly
- [ ] Bug bounty program live (Immunefi recommended) before mainnet
- [ ] All contracts verified on Etherscan

## 2. Key Management

- [ ] Gnosis Safe created at safe.global with 5 signers (3-of-5 threshold)
- [ ] Signer addresses confirmed with each key holder (hardware wallets only)
- [ ] Safe tested on testnet with mock transactions
- [ ] config/mainnet.json filled with real Safe address
- [ ] Deployer EOA private key destroyed after handoff

## 3. Timelock

- [ ] SWRTimelock deployed with 172800s (48h) min delay
- [ ] Gnosis Safe confirmed as sole PROPOSER and EXECUTOR
- [ ] Timelock admin revoked (address(0) — self-sovereign)
- [ ] Test proposal + execution cycle on testnet

## 4. Role Separation

- [ ] DEFAULT_ADMIN_ROLE → SWRTimelock (not EOA)
- [ ] COMPLIANCE_ROLE → Dedicated compliance officer wallet (hardware)
- [ ] ISSUER_ROLE → ROSHN SPV wallet
- [ ] MANAGER_ROLE → Asset manager company wallet
- [ ] REGULATOR_ROLE → CMA regulator address (optional)
- [ ] Deployer EOA holds no roles after deployment

## 5. SARX Stablecoin

- [ ] Production SARX contract audited and address confirmed
- [ ] SARX issuer is CMA-licensed
- [ ] SARX has adequate liquidity for yield distributions
- [ ] SARX address set in config/mainnet.json (not MockERC20)

## 6. Legal & Regulatory

- [ ] CMA approval obtained (see docs/cma-checklist.md)
- [ ] Fatwa certificate issued by Shariah Supervisory Board
- [ ] SPV registered in Saudi Arabia (CR number verified)
- [ ] Investor onboarding flow reviewed by legal counsel
- [ ] KYC/AML process reviewed by compliance team
- [ ] T&Cs and prospectus approved by CMA

## 7. Operations

- [ ] Monitoring set up (Tenderly / OpenZeppelin Defender alerts)
- [ ] Incident response plan documented
- [ ] Emergency pause procedure tested (compliance officer can pause in <5 min)
- [ ] Yield distribution schedule agreed with asset manager
- [ ] First yield epoch amount confirmed and SARX pre-funded

## 8. Frontend

- [ ] Dashboard and issuance portal pointing to mainnet contracts
- [ ] contracts.js updated with mainnet addresses and chainId: 1
- [ ] Hosted on production domain (not localhost)
- [ ] HTTPS enforced
- [ ] MetaMask network prompt shows Ethereum Mainnet

## 9. Go-Live Sequence

1. Deploy SWRTimelock
2. Deploy KYCWhitelist (admin = Timelock)
3. Deploy SWRToken (admin = Timelock)
4. Deploy AssetToken (admin = Timelock, issuer = SPV)
5. Deploy YieldDistributor (admin = Timelock)
6. Schedule setYieldDistributor via Safe → Timelock (wait 48h)
7. Execute setYieldDistributor
8. Compliance officer approves first batch of investors
9. Issuer distributes tokens to KYC-approved investors
10. Asset manager deposits first yield epoch
