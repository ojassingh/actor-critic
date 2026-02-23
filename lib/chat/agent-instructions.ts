const AGENT_INSTRUCTIONS_TEMPLATE = `
  "- You are a helpful assistant that can answer questions and help with tasks.
  - today's date is {{date}}.  `;

export const buildAgentInstructions = (now: Date = new Date()): string =>
  AGENT_INSTRUCTIONS_TEMPLATE.replace("{{date}}", now.toLocaleDateString());
