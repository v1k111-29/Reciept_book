# S14 Team Briefing (v3): when an exporter's payment goes "missing" in government records, and what our project does about it

*For the 5-member team, DRUNIX Hackathon 2026 (NPCI x Citi). v1 written 15 Oct 2026; v2 16 Oct; **v3 16 Oct 2026** merges v1 and v2 and corrects both. No fintech knowledge is assumed. Hard words are explained where they first appear and again in the **Index of terms (Part 10)**.*

---

## What changed, version by version

**v2 over v1** (all kept in v3):
1. **The eBRC is no longer blocked by the bank's EDPMS closure.** Under DGFT's revamped eBRC system (pilot 15 Nov 2023, all banks moved by 31 Jan 2024), banks send each incoming payment's record (IRM) to DGFT when the money arrives, and the **exporter self-certifies the eBRC**. v1 said "without closure there is no eBRC"; that is wrong for the current system.
2. **New primary evidence: CAG Report 33 of 2025**, which found Customs' own system (ICES) showing realised payments as pending or even nil, and recommended syncing it with RBI's EDPMS.
3. **The main harm is now Customs drawback recovery**, not eBRC denial.
4. **A wide prior-work search** (Part 5), and a **deadline check** (Part 0).

**v3 over v2** (each was checked against its source on 16 Oct; see Part 9):
1. **MonetaGo correction.** v2 called MonetaGo's Hyperledger Fabric network on TReDS "the best precedent for our pattern" and described it as still running on Fabric. A May 2024 article says the TReDS platforms **migrated that system from DLT to confidential cloud computing**. The precedent now cuts both ways (Parts 5.3, 6.7, 7).
2. **CAG Report 17 of 2020 figures corrected.** Audit cross-checked 1,377 shipping bills (FOB ₹128.11 crore) and found **609 bills with ₹36.40 crore not realised in time**. The "₹128" is a coincidence with the Mangaluru ₹128 crore: one is the FOB value of goods, the other a drawback amount. Don't mix them up in the pitch.
3. **Chennai Customs notice** is **Public Notice 21/2024, dated 31 Dec 2024** (v2 said "PN 21, Jan 2025").
4. **CAG Report 33 of 2025 details added:** 66 observations, 19 recommendations, revenue implication ₹701.69 crore; integration with DGFT, GSTN and SEZ is **Recommendation 8**.
5. **Deadline:** Project Axis's repo does list 25 Oct 2026 for pitch submission, but under its own challenge code (CHL-7007). Ours may differ.
6. **Status label:** v2 changes how S14 is framed after the debate ended. Under the debate's own rule this is an **un-debated revision**; see Part 0.
7. Kept from v1: the measure "days from document hand-over to a provable bank acknowledgement" (now one of three measures, 6.6).

---

## Contents

0. Read this first: status, honesty notes, deadline, tags
1. The whole thing in 60 seconds
2. Who is involved (the cast)
3. How an export is recorded today, step by step
4. Where it breaks (the problem), with proof
5. What has been tried before, and where each attempt stops
6. Our project: what we build and what our role is
7. Objections we should expect, and honest answers
8. What the team must do now
9. Sources
10. **Index of terms** (jargon explained)

---

## 0. Read this first

**What is and is not settled**

- Our AI-run debate compared 17 problem statements. On its numbers S14 came first (54.9 out of 100, against 48.7 for the next). But the debate's audit **failed**: the briefing notes given to the AI "advocates" contained opinions written by the orchestrating AI, including on S14. So the debate did **not** officially select S14. **The team has chosen it.**
- **v3 is an un-debated revision.** The debated S14 was "bank delays block the exporter's proof of payment". v3's framing ("three agencies' records disagree, and Customs recovers drawback") rests on evidence the debate never saw (DGFT FAQ, CAG 2025). The debate's scores do not cover it. That is fine for a team choice; just don't present the 54.9 as a score for v3.
- Three fact-checking AIs rated the need for Drunix as **"weak"** for every finalist, S14 included, and S14's author conceded "a Drunix pilot is optional". CAG's own fix is central (sync ICES with EDPMS), which makes the plain-integration alternative more concrete. Part 6.7 deals with this openly.
- No teammate has yet opened the sources by hand. Part 8 lists what to open first.
- S14's own track-fit note says "Partly": the money is an inbound cross-border payment, but the failure is in record-keeping after it arrives.
- **Deadline:** our notes say 16 Oct. Project Axis, another team in this hackathon, lists in its public repo: 9 Oct build kickoff, **25 Oct pitch submission**, 10 Nov top 25, 10-22 Nov prototype build, 22 Nov final solution, 27 Nov top 5, 4 Dec grand finale (verified 16 Oct). Their challenge code is CHL-7007 (theme Cross-Border Remittances); ours may differ. **Confirm with the organisers today.**

**Tags used in this file**

| Tag | Meaning |
|---|---|
| [P] | Primary source: a regulator, auditor or government document (RBI, DGFT, CAG, Customs, Drunix's own pages) |
| [S] | Secondary source: news, an advisory firm, a bank FAQ, a trade-body page, another team's repo |
| [V] | The source is a company with a commercial interest |
| [I] | Inference: our reasoning or the AI's, not shown by a source |
| [U] | Unknown or not verified |
| *checked 16 Oct* | An AI tool re-read the source on 16 Oct and it matched (still not a human read) |

Every [P] and [S] is AI-read only. Re-checked on 16 Oct: DGFT eBRC FAQ, CAG Report 33/2025 press release, CAG Report 17/2020 ch. 5, RBI press release of 11 Jul 2025, Chennai PN 21/2024, Project Axis repo.

---

## 1. The whole thing in 60 seconds

Indian companies that sell goods abroad ("exporters") get paid by foreign buyers through a bank. By RBI's rules that bank must record the payment against the shipment in a database called **EDPMS** (run by RBI, India's central bank) and then "close" (mark off) the entry. From EDPMS, the realisation data is meant to flow to Customs' own computer system (**ICES**), which Customs uses to decide whether the export refund it already paid (**drawback**) can stay with the exporter [P].

If the record is not updated anywhere along that chain, Customs treats the payment as missing and can demand the drawback back **with interest** [P]. One Customs notice listed **22,539 shipping bills (2020-22), about ₹128 crore of drawback, shown as payment-pending** [P]. In December 2025 the national auditor (**CAG**) reported that ICES kept showing payments as pending, and even nil, when they had been fully realised, and recommended syncing Customs' records with EDPMS [P, checked 16 Oct].

The proof of payment for incentives (**eBRC**) is now a separate track: since early 2024 the exporter self-certifies it on DGFT's portal from the bank's payment message, without waiting for the bank to close the EDPMS entry [P, checked 16 Oct].

**Our project:** a small pilot of a shared, tamper-evident, time-stamped record for each shipping bill, kept on **Drunix** (NPCI's blockchain platform). The bank and the exporter's side, and later Customs, sign off each milestone ("documents received", "payment received", "eBRC self-certified", "EDPMS marked off", "Customs shows realised"). Everyone can then see and prove which record is out of step, and since when. It does not move money and does not replace EDPMS, DGFT's eBRC system or ICES.

---

## 2. Who is involved (the cast)

| Who | What they do in this story | Tag |
|---|---|---|
| **Exporter** | Sells goods abroad, files a shipping bill, self-certifies the eBRC, needs the drawback to stay settled | |
| **Foreign buyer** | Pays the exporter | |
| **AD bank** (authorised dealer bank) | A bank allowed to handle foreign money. Receives the payment, sends the payment record (IRM) to DGFT, links the payment to the shipment in EDPMS, closes the entry | [P]/[S] |
| **RBI** (Reserve Bank of India) | Introduced EDPMS in February 2014 and sets the rules | [P] |
| **Customs (CBIC)** | Processes the shipping bill, pays drawback, monitors realisation through its **RBI-BRC module** in **ICES**, recovers drawback if payment isn't recorded | [P] |
| **ICES** (Indian Customs EDI System) | Customs' internal computer system; receives realisation data from EDPMS | [P] |
| **ICEGATE** | Customs' online portal. Shows a shipping bill's EDPMS status; users can raise a query to rectify it | [P] |
| **DGFT** (Directorate General of Foreign Trade) | Runs export schemes and the eBRC system; receives IRMs from banks; exporters self-certify eBRCs there | [P] |
| **CAG** (Comptroller and Auditor General) | India's national auditor; audited the drawback scheme in Report 33 of 2025 | [P] |
| **Nasscom** | The IT industry's trade body; wrote to RBI and FEDAI about delays in 2022-23 | [S] |
| **FEDAI** | The banks' association for foreign-exchange dealing | [S] |
| **NPCI** | Runs UPI, published Drunix, and is the hackathon organiser (with Citi) | [P] |

---

## 3. How an export is recorded today, step by step

*The "before" picture, without our project. Follow one shipment. "Asha" is invented for illustration.*

**Step 1. Ship the goods and file a shipping bill.** Asha, who makes machine parts, ships a consignment to a US buyer. A **shipping bill** is the customs paper filed for each export shipment. The "flow of shipping bills from the Customs Authority has been automated through ICEGATE", so an EDPMS entry opens [P: RBI press release, 11 Jul 2025, checked 16 Oct]. (Software and other service exporters use a different lane; see the end of this part.)

**Step 2. Give the bank the documents.** Asha hands her AD bank the invoice and shipping-bill papers. One advisory site says within 21 days [S][V: Skydo; verify]. The entry shows as **"Pending Acknowledgement"** [S][V: Skydo].

**Step 3. The buyer pays; the bank reports the payment.** The money lands at Asha's AD bank. The bank creates an **IRM** (Inward Remittance Message) and issues an electronic proof of receipt (**e-FIRC / FIRA**) [S]. Banks "need to report the IRM as on remittance received", and IRM reporting "is independent of the documents" [P: DGFT FAQ Q57, Q28, checked 16 Oct].

**Step 4. Asha self-certifies her eBRC on DGFT.** She matches the IRM to her shipping bill on the DGFT portal and generates the eBRC herself. She cannot do it without an IRM (FAQ Q30). If the shipping bill isn't visible, she "can add meta data of shipping bill and will be able to generate eBRC" (Q25). DGFT says "EDPMS and eBRC operate as distinct systems" (Q23, Q41) [P, checked 16 Oct]. The eBRC is used for GST refunds and incentives [S].

**Step 5. The bank links the payment to the shipment in EDPMS and closes the entry.** The bank checks the documents against the payment and marks off the entry "after ensuring that the export value has been realised" [P, tool summary, Reg 18(1)(g)]. **That summary states no time limit for this step** [U: read the regulation yourself]. This is still the bank's action, not the exporter's.

**Step 6. The realisation reaches Customs.** From EDPMS the data goes to ICES [P: Customs notice 12/2024]. Customs has monitored realisation through this **RBI-BRC module** for shipping bills with a Let Export Order on or after 1 April 2014 [P: JNCH PN 137/2018]. ICEGATE users "can now raise the query related to rectification of SB EDPMS Status" [P: Chennai PN 21/2024, 31 Dec 2024, checked 16 Oct].

**Step 7. Customs keeps or recovers the drawback.** **Drawback** is a refund of duty on goods that are then exported. It is paid after shipment, but realisation of the money is a condition for keeping it. If ICES shows the payment as unrealised, Customs can recover the drawback "along with interest" [P].

**Step 8. The clock.** For goods, payment must arrive within **nine months of shipment** (twelve if invoiced in rupees) under the 2026 regulations; the AD bank can extend on request [S][V: EximPe]. An earlier rule said fifteen months [S].

**Shortcuts and a different lane**

- *Small bills:* since RBI **Circular 12 of 1 October 2025**, a bank can close entries of **₹10 lakh or less per shipping bill** on the exporter's declaration, given quarterly in bulk; no penal charges for delays on these [S: CAPEXIL]. A bank FAQ (Indian Bank, Mar 2026) says this took effect on **24 Oct 2025**, through an EDPMS **"Small Value Closure" module** [S].
- *Above ₹10 lakh:* no source we read changes the normal process [I].
- *Service exporters* file a monthly **EDF** from **1 October 2026**; the bank enters it in EDPMS within five working days [S]. Our evidence is about **goods and shipping bills**.

---

## 4. Where it breaks (the problem), with proof

### 4.1 What goes wrong when a record isn't updated

- **Customs recovers drawback with interest** if ICES shows the payment as unrealised [P: Customs notice 12/2024; Chennai PN 21/2024].
- Exporters face demand notices and manual checks even when the money has arrived: CAG says ICES "continues to display nil realization", compelling "unnecessary manual verification of physical e-BRCs" [P: CAG 33/2025, Para 5.1, checked 16 Oct].
- Pending entries can put the exporter on a **caution list**, with future shipments flagged [S][V: Skydo]. One source says that if proceeds stay unrealised a year past the due date, further exports need full advance payment or a letter of credit (Regulation 13) [S][V: EximPe; verify in RBI text].
- **No longer a main harm: eBRC denial.** Before 2024 a bank that didn't close the entry could block the eBRC (Nasscom's Dec 2022 complaint). Now the exporter self-certifies from the IRM [P]. *Residual risk* [U]: some advisory blogs still say the eBRC follows closure. Ask one exporter or CA whether any bank still links them in practice.

### 4.2 The evidence that it happens at scale

| What | Detail | Tag |
|---|---|---|
| **CAG Report 33 of 2025** (Duty Drawback Scheme, year ended 31 Mar 2023; tabled 18 Dec 2025) | 66 observations, 19 recommendations, revenue implication ₹701.69 crore. Para 3.1: "non-updation of already realized amounts indicates a critical flaw"; Customs cannot reliably identify genuine non-realisation, which defeats the purpose of integrating EDPMS with ICES. Para 5.1: ICES shows nil realisation even where proceeds were fully and timely realised. **Recommendation 3:** "The BRC module of ICES should be synchronized with the EDPMS module of RBI" in real time to avoid needless demand notices. **Recommendation 8:** integrate ICES with SEZ, GSTN and DGFT systems | [P, press release checked 16 Oct; full report not yet read] |
| **CAG Report 17 of 2020** (Customs, ch. 5) | Non-recovery of drawback against pending BRCs (e.g. ICD Panki: ₹9.05 crore recoverable). At ACC Bengaluru, cross-checking RBI data with DGFT e-BRC data on **1,377 shipping bills** (FOB ₹128.11 crore) found **₹36.40 crore not realised in time on 609 bills** | [P, checked 16 Oct] |
| Customs Public Notice **12/2024**, Mangaluru, 18 Jul 2024 (file name reads 13/2024) | **22,539 shipping bills** from 2020-21 and 2021-22, drawback **about ₹128 crore**, shown as realisation-pending. Payment shows on DGFT but "the same BRC is not reflected in RBI's EDPMS", so the ICES report shows FOB not realised; "may be due to" the AD bank not uploading. Recovery with interest threatened | [P] |
| Chennai Customs **PN 21/2024** (31 Dec 2024) and **PN 05/2025** (drive 29 Jan to 28 Feb 2025) | Proceeds "not realized even after completion of mandated period" for many bills; a dedicated **BRC Cell**; recovery "along with interest" | [P, checked 16 Oct]/[S] |
| JNCH (Nhava Sheva) PN 137/2018 | Defaulter lists from the RBI-BRC module quarterly since 2015 | [P] |
| Nasscom to RBI, **Dec 2022** | Banks demanded hard copies, gave no acknowledgement slip, delayed EDPMS updates, blocking eBRCs. **Predates the eBRC revamp** | [S] |
| Nasscom to FEDAI, **28 Jul 2023** | EDPMS entries pending with banks "for the last couple of years" | [S] |

*Careful with "₹128":* Mangaluru's ₹128 crore is **drawback**; CAG 2020's ₹128.11 crore is the **FOB value** of the bills it checked. Different things.

### 4.3 What we do NOT know (important)

1. **The cause split.** A Customs "payment pending" can come from at least four places [I]:
   - (a) the **bank** hasn't marked off EDPMS;
   - (b) EDPMS is updated but **ICES didn't pick it up** (CAG Paras 3.1, 5.1 show this happens);
   - (c) the **exporter's** paperwork or linkage is missing (an ELP law-firm note, Apr 2024, says EDPMS delays mainly stem from "procedural oversights");
   - (d) **genuine non-payment**.
   How the 22,539 bills split is **unknown** [U]. The CAG press release gives no count for (b).
2. **Does it still happen after October 2025?** CAG's 2025 audit covers the year to March 2023 [U].
3. **Why banks might delay.** "The bank bears no cost while the exporter pays" is our inference [I]; the S14 author withdrew it.
4. **The five-day rule.** Five working days to *enter* a declaration (Reg 18(1)(a)); no period stated for *marking off* (Reg 18(1)(g)), per the S14 author's reading [U].
5. **Has CBIC acted on CAG's Recommendation 3?** Not found. CBIC Circular 30/2026 (Jul 2026) answers a different CAG point [S].
6. **The FEDAI advisory's content**: never retrieved [U].

---

## 5. What has been tried before, and where each attempt stops

*Based on a wide search on 16 Oct 2026. Bottom line: **no public project, product, paper or pilot builds a shared ledger for EDPMS milestones or bank acknowledgements.** Closed bank systems and private repos can't be seen, so "none found" means "none public".*

### 5.1 Government fixes (closest to our problem)

| Attempt | When | What it did | Where it stops | Tag |
|---|---|---|---|---|
| **Customs RBI-BRC module** | From Apr 2014 | Reads realisation from EDPMS into ICES; defaulter lists | CAG (2025): ICES not reflecting realised amounts | [P] |
| **ICEGATE EDPMS enquiry + rectification query** | Query live by 31 Dec 2024 | Exporter checks status and raises a rectification query | A ticket, not a shared, timestamped proof of who acknowledged what | [P] |
| **DGFT revamped eBRC (self-certification)** | Pilot 15 Nov 2023; all banks by 31 Jan 2024 | Banks push IRMs to DGFT; exporter self-generates eBRC | Fixes eBRC; nothing for EDPMS mark-off or ICES | [P] |
| **DGFT eBRC API + bulk upload** (Trade Notice 12/2024-25) | Aug 2024 | Exporters' software connects to the eBRC system | Same as above | [P]/[S] |
| **RBI Circular 12** + **Small Value Closure** module | 1 Oct 2025; effective 24 Oct 2025 | Closure on declaration for bills ≤ ₹10 lakh | Nothing new above ₹10 lakh; effect unknown | [S] |
| **Trade Connect e-platform** (trade.gov.in) | Sep 2024 | One portal across DGFT, CBIC and others; issue logging | A grievance channel, not a milestone record | [P]/[S] |
| **CAG recommendations 3 and 8** | Dec 2025 | Sync ICES with EDPMS; integrate ICES with DGFT, GSTN, SEZ | Implementation not found | [P] |
| **New export-import regulations** | 1 Oct 2026 | Monthly EDF for services; bank enters within five working days | Not shown to cover goods or mark-off | [S] |
| **Nasscom letters / FEDAI advisory** | 2022-23 | Raised delays | Outcome not shown; partly overtaken by the eBRC revamp | [S] |
| **Customs drives** (Mangaluru 2024, Chennai 2024-25) | 2024-25 | Pressure on exporters; BRC cells | Aimed at exporters, who depend on banks and on ICES sync | [P]/[S] |

### 5.2 Commercial tools (exporter side, no ledger)

- **Niryatbox** (2026) describes an EDPMS screen that auto-drafts an email to the bank if an entry stays open past a window, e.g. 14 days after realisation [S][V]. This is our "measure the delay" idea without a ledger.
- **Terra Insight** describes reconciling ICEGATE shipping bills, the bank's SWIFT feed, EDPMS and DGFT eBRC data per shipping bill [S][V].
- **ebrc.in, Skydo, PayGlocal, Razorpay, EximPe:** guides and apps for eBRC generation and EDPMS closure [S][V].
- **Bank portals:** before the DGFT revamp, some banks let exporters match IRMs to shipping bills on the bank's portal (GJEPC, Nov 2023) [S].

### 5.3 Blockchain in Indian trade (none targets EDPMS)

| Project | When | What | Relevance to us | Tag |
|---|---|---|---|---|
| **MonetaGo on TReDS** | Live Mar 2018 on Hyperledger Fabric; **moved off DLT in 2024** | Duplicate-invoice check across competing TReDS exchanges without pooling documents. In 2024 RXIL, M1xchange and Invoicemart "migrated the invoice fingerprinting solution from DLT to confidential cloud computing". Still in wide use (C2treds 2025, KredX DTX 2025, SBI Factors 2025, SIDBI 2026) | **Cuts both ways.** It shows competitors will share one fact without sharing documents. It also shows that the operator later found it didn't need a ledger for that | [S] |
| **IDRBT + MonetaGo proof of concept** | 2017 | RBI's research arm tested a blockchain trade-finance app with NPCI and banks | RBI-side interest; not export realisation | [S] |
| **Infosys India Trade Connect → IBBIC** | 2018 → 2021 | Bank consortium (15, later 18 banks) for domestic letters of credit | Dec 2022: still scoping; current status not found [U] | [S] |
| **HSBC-Reliance LC on Corda; ICICI-Emirates NBD** | 2016-18 | One-off blockchain trade-finance deals | Financing documents, not regulatory records | [S] |
| **Federal Bank + WaveBL** | 2024 | Digital export bill via blockchain eBL | Document transfer only | [S] |
| **CBIC blockchain cargo pilot** | Oct 2021 | Customs pilot for container documents and GPS | Customs has trialled blockchain; logistics, not money | [S] |
| **NPCI Vajra** | 2019-20 | Permissioned ledger for clearing; NPCI said it would cut reconciliation pain | NPCI's own earlier reconciliation-on-ledger idea | [S] |

**Lesson from abroad:** we.trade (shut June 2022), Contour (bank shareholders stopped funding) and Marco Polo (insolvency after failing to raise cash) closed for money and adoption reasons, not technology [S]. **Propose a small pilot, not a platform that needs everyone on day one.**

### 5.4 Other teams in this hackathon (public GitHub repos)

RemitSync, Project Axis, Nexus-PvP, Pravah, an RWA settlement project, and **DRUNIX TradeShield** (closest: Indian trade, import side, ICEGATE-style Bill of Entry) [S]. **None found on EDPMS, eBRC or drawback.** Our angle appears unclaimed among public entries [I].

### 5.5 Abroad

No central bank was found using a ledger to monitor export proceeds. Pakistan routes exporter declarations through its Pakistan Single Window (a central system); Bangladesh has run blockchain inland LCs [S].

---

## 6. Our project: what we build and what our role is

### 6.1 In one sentence

> A small pilot where an exporters' body and at least two banks keep a shared, time-stamped record of each shipping bill's milestones on Drunix, so that when the bank's EDPMS update, the DGFT eBRC and Customs' records disagree, everyone can see which step is missing, who signed what, and since when.

### 6.2 The picture

```
TODAY                                         WITH OUR PILOT (beside, not instead of, existing systems)

Exporter --docs--> Bank --IRM--> DGFT (eBRC)  Exporter --docs--> Bank
                    |                             |                 |
                    v                             | signs "handed   | signs "received",
                 EDPMS (RBI)                      |  over"; "eBRC   |  "payment received",
                    |                             |  self-certified"|  "EDPMS marked off"
                    v  (sync can fail: CAG 2025)  v                 v
                 ICES (Customs) --> drawback   +--------------------------------+
                                    recovery   |  SHARED RECEIPT BOOK (Drunix)  |
   three records, three owners,                |  one record per shipping bill  |
   no shared timeline                          |  milestones + time stamps      |
                                               +--------------------------------+
                                                 visible to: exporter, bank, Customs (read-only later)
```

### 6.3 What one record contains

From the S14 design (the author's proposal, [I] unless stated):

- **On the shared book (on-chain):** shipping-bill ID; milestones in order: **documents handed over/acknowledged → payment received (IRM reference) → eBRC self-certified (eBRC number) → EDPMS marked off → Customs shows realised**; time stamps; **hashes** of documents. A hash is a short fingerprint: it proves a document hasn't changed without putting the document on the book.
- **Kept private (off-chain):** invoices, forms, amounts and buyer details stay with bank and exporter. Amounts, if shared, go only to that exporter's bank and the exporters' body (Drunix "private data").
- **Rules enforced on the ledger** (*chaincode*): an acknowledgement is valid only when **both** the bank and the exporter side approve it (an "endorsement policy"); only the remitting bank may mark "EDPMS marked off"; the "eBRC self-certified" milestone is signed by the exporter's side.

### 6.4 Who runs it in the pilot

At least two AD banks (separate legal entities) plus one exporters' body. Each runs a **Lite Peer** (approves transactions) and a **Committing Peer** (records them). The orderer would be shared among members, not run by one party. **RBI, Customs and DGFT could join later as read-only viewers; their systems are not expected to join a pilot** [I]. We have not asked any bank or trade body whether they would join [U].

### 6.5 A walk-through (invented example)

1. Asha hands her bank the papers for shipping bill SB-123. Asha's side and the bank sign "documents handed over / received" with the time. This is the acknowledgement Nasscom said was missing in 2022 [S; may since have improved].
2. The buyer pays. The bank records "payment received" with the IRM reference.
3. Asha self-certifies her eBRC on DGFT; her side records "eBRC self-certified" with its number.
4. The bank marks off EDPMS and records "EDPMS marked off", with the time.
5. Months later, a Customs notice says SB-123 is realisation-pending. Asha, her bank and Customs open the shared record: payment on day X, eBRC on day Y, mark-off on day Z. The gap is then visibly downstream of the bank (the ICES sync CAG describes) or visibly at the bank (no mark-off yet), instead of argued over by phone.

### 6.6 What it can and cannot do

**Can:** make each milestone visible and provable; show when a Customs "pending" contradicts an earlier signed milestone; give exporters evidence instead of phone calls.

**Three measures** (baselines unmeasured today [U]):
1. Days from **document hand-over** to a provable bank acknowledgement (from v1).
2. Days from **payment received** to a provable **EDPMS mark-off** (from v2).
3. **Share of Customs "pending" flags that already had a signed mark-off**: our way to measure the cause split (from v2).

**Cannot:**
- Make a bank act faster. It shows delay; it does not force action.
- Fix the ICES-EDPMS sync. Only CBIC and RBI can do that (CAG Recommendation 3).
- Fix genuine non-payment.
- Change rules above ₹10 lakh.
- Stop DGFT, EDPMS and ICES disagreeing unless they read the book; otherwise ours is a *fourth* record.

### 6.7 Why Drunix at all? An honest answer

| Drunix feature | What we use it for |
|---|---|
| **Endorsement policy**: which organisations must approve a transaction | A receipt counts only with both bank and exporter-side signatures |
| **Private data**: shared only with eligible organisations | Keep amounts away from competing banks |
| **Ordered ledger** (orderer, committing peers) | One agreed sequence of events across several banks [I] |

**The honest counter-argument** (say it before a judge does):
- A **digitally signed receipt** can be checked by anyone without a ledger.
- **CAG's own fix is central**: sync ICES with EDPMS and integrate ICES with DGFT. Done well, much of the "phantom pending" problem goes away with no ledger.
- **MonetaGo moved off DLT in 2024** for its multi-party duplicate check. The closest Indian precedent for "competitors share one fact" chose not to need a ledger in the end.
- The fact-checkers rated Drunix's need "weak", and S14's rebuttal says "a Drunix pilot is optional".

**Our best answer**, limited to what evidence supports:
- The records sit with **three different owners** (RBI's EDPMS, DGFT's eBRC system, CBIC's ICES), plus several banks, and CAG found their integration deficient [P]. A neutral, ordered record signed by the parties, with no single operator holding the only copy, lets each party prove its own step without waiting for the agencies' systems to agree [I].
- MonetaGo ran across competing TReDS exchanges on Fabric from 2018 to 2024, which shows the pattern can operate in India. Its later move off DLT shows one operator was enough there; our case has **no obvious single operator**, because the three record-keepers are separate government bodies [I].
- We say plainly that a central integration may be cheaper, and that the pilot's first job is to **measure** the cause split.

Whether that is enough depends on the organisers' scoring rule, which we do not know. Ask them (Part 8).

### 6.8 Drunix facts and risks to know

- Open-source (Apache-2.0) private blockchain published by NPCI, a Hyperledger Fabric fork, "backwards compatible with HLF v2.5.x" [P]. Released publicly June 2026 [S].
- No speed (transactions-per-second) figures are published. **Make no performance claims** [P].
- Nine open issues, all filed 30 Jun 2026, including #8 "SQL and Redis written non-atomically on every block commit" [P]. The design assumes a non-SQL state database to avoid it [I].
- Sample network (`drunix-network/test-network`): Linux only; git, Docker, Go, jq, Bash 4+; `./network.sh prereq`, then `./network.sh up createChannel`; 2 organisations, 6 peers, one Raft orderer; chaincode in Go, Java, JavaScript or TypeScript; default database YugabyteDB [P, tool summary]. If the Project Axis timeline applies to us, the prototype build is 10-22 Nov, after the top-25 cut [S].

---

## 7. Objections we should expect, and honest answers

| Who might say it | The objection | Our honest answer |
|---|---|---|
| An RBI officer | "EDPMS is the system of record. A parallel ledger adds another record." | True. The pilot sits *beside* EDPMS as a proof layer; the next step would be RBI or CBIC reading it or hosting a node. |
| A DGFT officer | "The eBRC is self-service since 2024. What's left?" | Agreed; our v1 got this wrong. What's left is the EDPMS mark-off and Customs' drawback records, where CAG found realised payments still showing as pending. |
| A Customs officer | "CAG told us to sync ICES with EDPMS. Once we do, the problem is gone." | Possibly, and that would be good. The pilot would show how much is sync versus bank delay versus paperwork, which is useful either way. |
| A bank engineer | "Banks won't share customer data or run nodes for a pilot." | Only fingerprints and statuses go on the book; amounts stay off or in private data. TReDS exchanges did share a Fabric network for six years. Whether banks would join *ours* is untested [U]. |
| A sharp judge | "MonetaGo dropped blockchain. Why won't you?" | There, one company could run the check for everyone. Here, the three record-keepers are separate agencies and none runs the others' records [I]. If one agency (say CBIC via Trade Connect) took that role, a central system might win, and we'd say so. |
| A hackathon organiser | "This is not really a remittance problem." | The money is an inbound cross-border payment; the failure is in the record after it lands. The fit is partial and we say so. |
| A reviewer | "Why not a normal database?" | See 6.7. We say the Drunix need is not yet proven. |
| A sceptic | "Is the bank even the cause?" | Not always: CAG shows Customs' system is part of it. Measuring the split is the pilot's first deliverable. |
| A judge who searched | "Has anyone done this?" | Not publicly, as of 16 Oct 2026 (Part 5). We can name the adjacent work. |

---

## 8. What the team must do now

1. **Confirm the deadline** (16 Oct vs 25 Oct), our challenge code, and the pitch format with the organisers. Also ask: is a prototype required at pitch stage; is a partial fit with Cross-Border Remittances acceptable; is a Drunix pitch that admits a plain-database baseline acceptable.
2. **Open the two key sources first** (about 20 minutes each):
   - DGFT FAQ on eBRC self-certification (Q23, Q25, Q28, Q30, Q41, Q50, Q57).
   - CAG Report 33 of 2025: the press release, then Paras 3.1 and 5.1 and Recommendations 3 and 8 in the full report. Look for any count of bills shown pending despite realisation.
3. **Then:** Customs notice 12/2024; RBI regulations (Reg 4(2), 18(1)(a), 18(1)(g)); Chennai PN 21/2024; the two Nasscom pages; RBI Circular 12; CAG 17/2020 ch. 5. Links in Part 9.
4. **Ask two or three exporters, a CA, or a trade body:**
   - Since 2024, do you self-certify your eBRC? Has any bank still made you wait for closure?
   - Have you had a drawback-recovery notice **after** the money had arrived and the eBRC was generated? Was it the bank or Customs' record?
   - How long does your bank take to mark off EDPMS after payment?
   If most cases are Customs' own sync, tell the team lead: the pitch then centres on the three-agency record, not bank behaviour.
5. **Prototype:** if a prototype is needed (now or 10-22 Nov), one teammate with Linux (or WSL2/VM, our inference) runs the test network.
6. **Pitch skeleton:** problem with proof (CAG 2025 + Customs notices), the process (Part 3), the gap (Part 4), what exists (Part 5, briefly), what we build (Part 6), honest limits (6.6, 6.7).

---

## 9. Sources

*All AI-read; none human-read yet. ✔ = re-checked by an AI tool on 16 Oct 2026.*

**Regulators and auditors [P]**

| # | Source |
|---|---|
| 1 | DGFT eBRC page: https://www.dgft.gov.in/CP/?opt=ebrc |
| 2 ✔ | DGFT FAQs on self-certification of eBRC (v1.0, Mar 2024): https://content.dgft.gov.in/Website/DGFT%20FAQs%20on%20Self-Certification%20of%20eBRC.pdf |
| 3 | DGFT Trade Notice 33/2023-24 (via EEPC): https://info.eepcindia.org/files/1699800091.pdf ; council circular: https://chemexcil.in/circulars/circular-dgft-notice-on-pilot--launch--of--the--upgraded---electronic---bank---realization-certificate---ebrc--system-for-self--certification-by-exporters--reg/6011/106751e196ca99916750a29487730c7f.html |
| 4 | DGFT eBRC API and bulk upload notice (via EEPC): https://info.eepcindia.org/files/1723798453.pdf |
| 5 ✔ | CAG press release, Report 33 of 2025: https://saiindia.gov.in/uploads/PressRelease/PR-Press-Brief-Eng-of-PA-33-of-2025-1-06944e363278d79-57590137.pdf ; full report: https://saiindia.gov.in/uploads/download_audit_report/2025/Report-No.-33-of-2025,-Union-Government-(English)-06a2ba801d2a2a5.47856233.pdf |
| 6 ✔ | CAG Report 17 of 2020, ch. 5: https://cag.gov.in/uploads/download_audit_report/2020/Union_INDT_Cus_CA_17_2020_chap_5-0605ae311973588.33092864.pdf |
| 7 | Customs Public Notice 12/2024, Mangaluru: https://bangalorecustoms.gov.in/wp-content/uploads/2024/08/mcc_pn_13_2024.pdf |
| 8 ✔ | Chennai Customs Public Notice 21/2024 (31 Dec 2024): https://chennaicustoms.gov.in/wp-content/uploads/2025/01/Public-Notice-21.pdf |
| 9 | JNCH Public Notice 137/2018: https://jawaharcustoms.gov.in/pdf/PN-2018/PN_137.pdf |
| 10 | RBI export-import regulations (FEMA 23(R)/2026-RB): https://www.rbi.org.in/Scripts/BS_FemaNotifications.aspx?Id=13277 |
| 11 ✔ | RBI press release on draft EDPMS directions (11 Jul 2025): https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=60821 |
| 12 | Drunix README and test-network README: https://raw.githubusercontent.com/npci/drunix/main/README.md ; https://raw.githubusercontent.com/npci/drunix/main/drunix-network/test-network/README.md |

**Secondary [S]**

| # | Source |
|---|---|
| 13 | Nasscom to RBI, Dec 2022: https://community.nasscom.in/communities/public-policy/feedback-reserve-bank-india-regarding-reconciliation-inward-remittances |
| 14 | Nasscom to FEDAI, 28 Jul 2023: https://community.nasscom.in/communities/public-policy/delays-banks-processing-export-documents-and-updating-edpms |
| 15 | RBI Circular 12 (republication): https://texprocil.org/images/circulars/1759473372-RBI_guidelines_.pdf ; CAPEXIL: https://capexil.org/government-reviews-edpms-idpms-guidelines-to-streamline-export-import-reconciliation/ |
| 16 | Indian Bank FAQ on small-value closure (Mar 2026): https://indianbank.bank.in/wp-content/uploads/2026/03/Simplified-reconciliation-mechanism-for-small-value-Shipping-Bills-SB-and-Bills-of-Entry-BOE-equivalent-to-INR-10-lakh-or-less.pdf |
| 17 | Texprocil circular on RBI-BRC module (2022): https://texprocil.org/circular/1647768737-Eserve-54_of_2022.pdf |
| 18 | Chennai Customs drive (republication): https://taxguru.in/custom-duty/brc-compliance-drive-exporters-chennai-customs.html |
| 19 | GJEPC on DGFT eBRC revamp (Nov 2023): https://gjepc.org/solitaire/?p=23779 ; on Trade Connect: https://gjepc.org/solitaire/?p=34050 |
| 20 | CBIC Circular 30/2026: https://worldtradescanner.com/30-CBIC%20Circular-03.07.2026.htm |
| 21 | MonetaGo on TReDS, 2018 (GTR): https://www.gtreview.com/news/fintech/blockchain-solution-to-prevent-trade-finance-fraud-goes-live-in-india/ ; **migration from DLT, 7 May 2024 (TFG):** https://www.tradefinanceglobal.com/posts/indian-treds-platforms-advance-rapid-invoice-deduplication-new-global-standards/ ; C2treds 2025: https://magazine.factoring.org/news/monetago-global-fraud-prevention-technology-utilised-as-c2treds-marks-first-year-of-operations-on-indias-treds ; SIDBI 2026: https://www.merchantseye.com/news/sidbi-deploys-monetago-secure-financing-across-msme-lending-operations-95de3ccc ; IDRBT PoC: https://bitcoinmagazine.com/?p=24405 |
| 22 | IBBIC: https://www.grantthornton.in/insights/blogs/ibbic-paving-way-for-blockchain-adoption-by-indian-banks/ ; status Dec 2022: https://inc42.com/?p=373063 |
| 23 | Federal Bank-WaveBL: https://www.tradefinanceglobal.com/posts/wavebl-federal-bank-partner-streamline-digital-trade-announce-successful-transaction-india/ ; HSBC-Reliance: https://www.businesstoday.in/current/economy-politics/in-a-first-hsbc-makes-overseas-transaction-for-reliance-industries-via-blockchain/story/288305.html |
| 24 | CBIC blockchain cargo pilot: https://qz.com/india/2075021/india-is-testing-blockchain-technology-for-its-logistics-industry ; NPCI Vajra: https://www.mobigyaan.com/npci-vajra-blockchain-platform-announced |
| 25 ✔ | Other Drunix teams: https://github.com/ferroflux/project-axis (timeline checked) ; https://github.com/charveemasand108/Remitsync ; https://github.com/ShreyasDr71/citixdrunx ; https://github.com/Froglodyte/nexus-pvp ; https://github.com/ParthSawant1405/Pravah ; https://github.com/Sakshihr18/gamma_ |
| 26 | Pakistan exporter declarations via PSW: https://nukta.com/pakistan-central-bank-tightens-exporter-declaration-rules |
| 27 | Blockchain trade-finance closures: https://www.fintechfutures.com/blockchain-crypto-digital-assets/blockchain-based-trade-finance-platform-we-trade-shuts-shop ; https://www.gtreview.com/news/fintech/exclusive-contour-to-shut-down-as-bank-shareholders-pull-funding/ ; https://www.gtreview.com/news/fintech/marco-polo-brings-in-liquidators-as-funds-run-dry/ |
| 28 | ELP note, April 2024 (seen only through the S14 rebuttal): https://elplaw.in/wp-content/uploads/2024/04/Export-Import-Transactions-Navigating-Compliance-Challenges-of-EDPMS-IDPMS.pdf |

**Vendor [S][V]**

| # | Source |
|---|---|
| 29 | EximPe: https://eximpe.com/blog/b2b/edpms-vs-idpms ; https://eximpe.com/blog/b2b/brc-vs-ebrc-export-documentation |
| 30 | Skydo: https://www.skydo.com/blog/understanding-edpms-full-form-and-its-essential-role-in-export-management ; https://www.skydo.com/blog/edpms-entry-not-closed |
| 31 | Niryatbox: https://niryatbox.com/blog/edpms-closure-for-indian-service-exporters ; Terra Insight: https://www.terra-insight.com/insights/e-brc-electronic-bank-realisation-certificate-textile-export/ ; ebrc.in: https://ebrc.in/resources/how-to-generate-ebrc-on-dgft-portal |
| 32 | taxguru, EDPMS visibility (Dec 2025): https://taxguru.in/rbi/faster-payments-edpms-rbi-bank-real-time-visibility-shipments.html ; startupadvisory.in, EDF rules: https://www.startupadvisory.in/blog-export-of-services-reporting-rbi-edf-fema-2026.htm (note: this page also says "without closure there is no eBRC", which DGFT's FAQ contradicts) |
| 33 | The debate record (S14 opening, rebuttal, fact-check, FINAL.md) in `drunix-debate/` of the debate-log zip |

---

## 10. Index of terms (jargon explained)

*Terms marked † are general background that was not looked up. Alphabetical.*

- **AD bank (authorised dealer bank):** A bank RBI allows to handle foreign-exchange business, including receiving export payments and recording them.
- **API†:** A defined way for one computer system to ask another for data or send it an instruction.
- **Apache-2.0:** A licence letting anyone use, copy and change the software, with no warranty.
- **BRC / eBRC (bank realisation certificate):** Proof that payment for an export arrived. Since 2024 the electronic version is **self-certified by the exporter** on DGFT's portal from the bank's IRM. Used for GST refunds and incentives.
- **CAG:** Comptroller and Auditor General of India, the national auditor.
- **Caution list:** A list under RBI's rules of exporters with long-pending unrealised proceeds; shipments can be flagged and benefits denied.
- **Chaincode:** The program on a Hyperledger Fabric or Drunix ledger that enforces the shared rules, such as who may change a record.
- **Close / mark off (an EDPMS entry):** The bank's final step confirming the money for a shipment arrived and matches the shipping bill.
- **Committing Peer:** In Drunix, the computer that checks and writes transactions to the ledger.
- **Confidential computing†:** Processing data inside protected hardware so even the operator can't read it; what MonetaGo moved to in 2024.
- **Consensus†:** How a shared ledger's computers agree on the order of transactions.
- **Corrigendum:** A formal correction to a published notice.
- **Crore and lakh:** 1 lakh = 100,000; 1 crore = 10,000,000. ₹128 crore = 1,280 million rupees.
- **Customs (CBIC):** Central Board of Indirect Taxes and Customs; handles shipping bills and pays or recovers drawback.
- **DGFT:** Directorate General of Foreign Trade; runs export schemes and the eBRC system.
- **DLT (distributed ledger technology):** A shared record kept in step by several organisations with no single owner. Blockchain is one kind.
- **Drawback:** A refund of duty paid on goods that are then exported. Customs may take it back, with interest, if its records show the payment as unrealised.
- **Drunix:** NPCI's open-source private blockchain, compatible with Hyperledger Fabric 2.5.
- **EDF (export declaration form):** The monthly form for service exporters from 1 Oct 2026.
- **EDPMS:** Export Data Processing and Monitoring System; RBI's database matching each export shipment to its payment (introduced Feb 2014).
- **Endorsement / endorsement policy:** An organisation's approval of a transaction; the policy says which organisations must approve before it is recorded.
- **FEDAI:** Foreign Exchange Dealers' Association of India, the banks' association.
- **FEMA:** Foreign Exchange Management Act, the law behind India's foreign-exchange rules.
- **FIRC / e-FIRC / FIRA:** The bank's electronic proof that foreign money was received.
- **FOB value†:** "Free on board": the value of goods at the export port, before freight and insurance.
- **Hash:** A short fingerprint of a file. If one letter changes, the fingerprint changes.
- **Hyperledger Fabric:** An open-source framework for shared ledgers among organisations that know each other. Drunix is based on it.
- **IBBIC:** Indian Banks' Blockchain Infrastructure Company, a bank consortium (2021) for blockchain letters of credit.
- **ICEGATE:** Customs' online portal; has an EDPMS status enquiry and a rectification query.
- **ICES:** Indian Customs EDI System, Customs' internal system. It receives realisation data from EDPMS and decides whether drawback is at risk.
- **IRM (inward remittance message):** The bank's record of each incoming foreign payment, sent to DGFT on receipt.
- **Ledger:** The shared record book in a DLT.
- **Let Export Order†:** Customs' permission for goods to leave the country.
- **Letter of credit (LC)†:** A bank's promise to pay a seller once specified documents are presented.
- **Lite Peer:** In Drunix, a computer that only approves (endorses) transactions and keeps no ledger copy.
- **MonetaGo:** A company whose duplicate-invoice check has run across India's TReDS exchanges since 2018; on Hyperledger Fabric until 2024, then on confidential cloud computing.
- **MSME†:** Micro, small and medium enterprises.
- **Nasscom:** India's IT industry trade body.
- **Node†:** One computer in a shared ledger.
- **NPCI:** National Payments Corporation of India, which runs UPI and published Drunix.
- **On-chain / off-chain:** On-chain data is written to the shared ledger; off-chain data stays in an ordinary system.
- **Orderer:** The ledger component that puts transactions in one agreed order and groups them into blocks.
- **Peer:** A computer run by one organisation that holds a copy of the ledger or checks transactions.
- **Pilot:** A small trial of a new system before wide use.
- **Private data:** In Drunix and Fabric, data shared only with eligible organisations and not kept on the shared ledger.
- **Prototype:** A small working version built to test an idea.
- **Public notice:** A formal announcement by an authority such as Customs.
- **Raft†:** A method the ordering computers use to agree on order; the test network uses one Raft node.
- **RBI:** Reserve Bank of India, the central bank.
- **RBI-BRC module:** The part of ICES that reads realisation data from EDPMS to monitor drawback, in use since April 2014.
- **Realisation (of export proceeds):** The money for an export actually arriving.
- **Reconciliation:** Matching two or more parties' records of the same transaction and fixing differences.
- **Regulation 18 / 4(2):** The RBI rules requiring AD banks to enter, monitor and close EDPMS entries.
- **Self-certification (of eBRC):** The exporter matches the bank's IRM to the shipping bill on DGFT's portal and generates the eBRC (pilot Nov 2023, all banks by Jan 2024).
- **Shipping bill:** The customs document filed for each export shipment.
- **Signed receipt:** A digitally signed acknowledgement anyone can verify without a ledger.
- **Small Value Closure module:** The EDPMS feature (Oct 2025) for closing bills of ₹10 lakh or less on the exporter's declaration.
- **SOFTEX†:** The older software-export form, withdrawn from 1 Oct 2026 per one source.
- **State database (YugabyteDB, CouchDB, LevelDB):** Where a ledger node stores the current value of each record. Issue #8 concerns the SQL (Yugabyte) setup.
- **Tamper-evident:** Changes can be detected afterwards. It does not mean changes are impossible.
- **Time stamp†:** A recorded time showing when something was done.
- **Track:** One of the hackathon's three themes: Real-Time Payments, Real Asset Tokenization, Cross-Border Remittances.
- **Trade Connect:** The Commerce Ministry's e-platform (trade.gov.in) linking exporters with DGFT, Customs and others; includes issue logging.
- **TReDS:** Trade Receivables Discounting System, RBI-licensed exchanges where small businesses sell invoices for early payment.
- **Un-debated revision:** A version of a statement changed after the debate ended, so the debate's scores don't cover it.
- **UPI:** Unified Payments Interface, India's instant bank-to-bank payment system, run by NPCI.
- **Validation Service:** In Drunix, a stateless component that checks transactions so the peers can scale.
- **Vajra:** NPCI's earlier (2019-20) permissioned blockchain for payment clearing and reconciliation.
- **Walk-through:** A step-by-step example (Part 6.5 is invented, not real data).
