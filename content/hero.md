# Orchestration workers

This is a Next.js and Convex app built around the evaluator-optimizer architecture. As agentrecipes.com puts it, "the actor proposes actions, the critic evaluates them." 

It is a compliance engine for medical and marketing copy.

## Why it works

By separating decision making from evaluation, the model stays much more stable. The Actor writes drafts and extracts claims. It never grades its own homework. The Critic takes those claims, searches the clinical PDFs, and evaluates them strictly against the evidence. 

If the Critic flags a hallucination, the Actor is forced to rewrite it. 

## Under the hood

[AGENT OUTPUT: Inject the main routes from ROUTE_SYSTEM_PROMPT in route.ts]

[AGENT OUTPUT: Inject the list of ingested clinical PDFs from the Convex knowledgeBaseFiles table]

## What you can do here

Explore the architecture and build intuition from small experiments.

* Paste a marketing claim to watch it get verified against clinical sources.
* Ask it to draft an email. It writes it, fact-checks it, and fixes it automatically if anything fails.
* Click any citation. It opens the exact page in the source PDF with the passage highlighted.

[AGENT OUTPUT: Inject a live example of a recently verified claim with its matching_text]
