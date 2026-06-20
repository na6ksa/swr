# SWR Platform — CMA Filing Checklist
## Capital Market Authority (هيئة السوق المالية) — Saudi Arabia

---

## Overview

SWR tokenizes Saudi real-world assets (real estate, sukuk, infrastructure, commodities)
as regulated security tokens under the CMA's fintech sandbox framework and the
Real Estate Investment Traded Fund (REIT) regulations.

**Regulatory framework:**
- CMA Fintech Lab (تقنية المال) — sandbox license for digital asset platforms
- Real Estate Investment Regulations (لوائح صناديق الاستثمار العقاري)
- Anti-Money Laundering Law (نظام مكافحة غسل الأموال)
- Cybersecurity Framework — SAMA/CMA joint requirements

---

## Phase 1: Fintech Lab Application

- [ ] Register at cma.org.sa Fintech Lab portal
- [ ] Submit business plan (see docs/business-plan-ar.html)
- [ ] Describe token model: security token, not utility token
- [ ] Describe KYC/AML process (on-chain + off-chain)
- [ ] Describe investor eligibility tiers (Retail / Professional / Institutional)
- [ ] Submit smart contract audit report
- [ ] Submit technical architecture document
- [ ] Describe custody model (who holds the SPV?)

## Phase 2: Legal Structure

- [ ] Establish Saudi holding company or SPV (شركة ذات مسؤولية محدودة)
- [ ] Register SPV under the asset's jurisdiction
- [ ] Obtain CR (Commercial Register) number for each asset SPV
- [ ] Legal opinion on token classification (security vs utility)
- [ ] Shariah Supervisory Board appointed (3 scholars minimum)
- [ ] Fatwa certificate obtained per asset class

## Phase 3: Asset-Specific Approval (per asset)

- [ ] Property title / ownership documents
- [ ] Certified valuation report (from CMA-licensed valuer)
- [ ] Audited financial statements (last 3 years)
- [ ] Environmental / regulatory clearances
- [ ] SPV articles of association reviewed by Shariah Board
- [ ] Investor prospectus (نشرة الإصدار) drafted and approved
- [ ] Maximum offer size approved by CMA
- [ ] Subscription period and closing dates set

## Phase 4: Investor Eligibility

Per CMA regulations and KYCWhitelist.sol tier model:

| Tier | Arabic | Min Net Worth | Max Investment |
|---|---|---|---|
| Retail (تجزئة) | مستثمر تجزئة | — | SAR 200,000 per asset |
| Professional (محترف) | مستثمر محترف | SAR 5M net worth OR SAR 1M invested p.a. | SAR 2,000,000 per asset |
| Institutional (مؤسسي) | مستثمر مؤسسي | CMA-licensed entity | Unlimited |

- [ ] KYC provider integration (SADAD / Nafath identity verification)
- [ ] Proof of investor net worth process documented
- [ ] AML screening process documented (SAMA blacklists)
- [ ] Shariah consent process documented

## Phase 5: Ongoing Compliance

- [ ] Quarterly financial reports to CMA
- [ ] Annual audited statements
- [ ] Yield distribution reports to investors
- [ ] KYC renewal process (365-day expiry enforced on-chain)
- [ ] Material event disclosures
- [ ] Incident reporting to CMA within 24 hours

## Phase 6: Technology Requirements

- [ ] Smart contracts audited by CMA-approved security firm
- [ ] Source code submitted to CMA for review
- [ ] Penetration testing report
- [ ] Data residency: investor data stored in Saudi Arabia (SDAIA compliance)
- [ ] Cybersecurity framework aligned with SAMA CSF
- [ ] Business continuity plan
- [ ] Disaster recovery procedure

---

## Key CMA Contacts

- Fintech Lab: fintech@cma.org.sa
- Investor Protection: investorprotection@cma.org.sa
- Website: cma.org.sa

## Timeline Estimate

| Phase | Duration |
|---|---|
| Fintech Lab application | 3–6 months |
| Sandbox approval | 1–3 months |
| Legal structure + SPV | 2–4 months |
| Asset-specific approval (per asset) | 2–3 months |
| First token issuance | 1–2 months after approval |
| **Total** | **~12–18 months** |
