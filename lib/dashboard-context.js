"use strict";

const DASHBOARD_CONTEXT = `You are the Corner Cube assistant for Ditto Design Studio.
Answer using the dashboard data below when it is relevant. If a question is outside this data, say so and still be helpful.
Keep replies concise. Use short lists when summarizing numbers.

Studio: Ditto Design Studio
Product: Corner Cube dashboard
Calendar month shown: September 2022 (today highlighted as the 14th)
Membership: no plan activated

Customer ratings:
- 5 star: 19
- 4 star: 33
- Below 3: 20
- Below 2: 9

New clients: 54
Overall projects: 166

To-do list (all deadlines 16/08/2022): Project A, Project B, Project C, Project D, Project E, Project F, Project G

Recent feedback:
- Sohail, TCS, rating 4.2, Dec 12 6:00 pm
- Manasa, Cognizant, rating 4.2, Oct 23 7:00 pm
- Sanath, Wipro, rating 4.2, Apr 16 7:30 pm
- Thousifa, Harman, rating 4.2, Dec 20 8:00 pm

Navigation areas: Dashboard, Listings, Clients, Feedback, Leadership, Vendors, Reports, Events, Advertisements, Help & Support.`;

function mockAssistantReply(messages) {
  const last = String(messages[messages.length - 1]?.content || "").toLowerCase();

  if (last.includes("rating") || last.includes("star")) {
    return [
      "Here’s a snapshot of customer ratings on the dashboard:",
      "- 5 star: 19",
      "- 4 star: 33",
      "- Below 3: 20",
      "- Below 2: 9",
      "",
      "Most reviews sit at 4 stars. 4-star plus 5-star ratings are 52 of 81 total.",
    ].join("\n");
  }

  if (last.includes("to-do") || last.includes("todo") || last.includes("deadline")) {
    return [
      "Your to-do list has 7 projects (A–G).",
      "Every item currently shows the same deadline: 16/08/2022.",
    ].join("\n");
  }

  if (last.includes("feedback") || last.includes("client") || last.includes("review")) {
    return [
      "Recent feedback (all rated 4.2):",
      "- Sohail, TCS — Dec 12, 6:00 pm",
      "- Manasa, Cognizant — Oct 23, 7:00 pm",
      "- Sanath, Wipro — Apr 16, 7:30 pm",
      "- Thousifa, Harman — Dec 20, 8:00 pm",
      "",
      "You also have 54 new clients and 166 overall projects.",
    ].join("\n");
  }

  if (last.includes("hello") || last.includes("hi") || last.includes("help")) {
    return "Hi — I can summarize ratings, list upcoming to-dos, or walk through recent client feedback. What do you want to look at?";
  }

  return [
    "I can help with Corner Cube dashboard data: ratings, new clients, projects, to-dos, and recent feedback.",
    "Ask something like “summarize my ratings” or “who left recent feedback?”",
    "",
    "(Demo reply — set OPENAI_API_KEY or add a key in Settings to use ChatGPT.)",
  ].join("\n");
}

module.exports = {
  DASHBOARD_CONTEXT,
  mockAssistantReply,
};
