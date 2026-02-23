# The MLR System, Explained Simply

This is a Next.js + Convex app built around an MLR system. The goal is simple: users can input a prompt to generate marketing emails or verify claims with evidence.

## Why it works

It separates drafting from evaluation, so responses stay grounded and consistent.

## Knowledge base ingestion

Clinical PDFs are uploaded and ingested into a shared knowledge base. We chunk files with Chunkr, index the chunks, and retrieve the most relevant passages at verification time.

## Under the hood

The AI architecture is orchestration + workers with an evaluator–optimizer loop. A lightweight router decides whether to generate, verify, or just chat, then routes to the right worker.

## What you can do here

Use it like this:

Example workflow (draft):
1. You ask for a marketing email.
2. It drafts the copy.
3. Claims are extracted and verified.
4. If something fails, it rewrites and attaches sources.

Example workflow (fact check):
1. You paste a claim.
2. It retrieves evidence.
3. You get a short supported/unsupported summary.

Illustrative example:
Claim: “Influenza vaccination provides important protection from influenza illness.”
Matched text: “Vaccination provides important protection from influenza illness.”
