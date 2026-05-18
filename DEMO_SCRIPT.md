# Demo Script

Example conversations to use when demoing the voice agent. Speak naturally — the agent will guide you through each step.

---

## Scenario 1: Reporting a New Issue

**You:** "I'd like to report a missed garbage pickup."

**Agent:** *(asks for your name)*

**You:** "John Smith"

**Agent:** *(asks for your phone number)*

**You:** "555-867-5309"

**Agent:** *(asks for issue type — missed service, billing, or other)*

**You:** "Missed service"

**Agent:** *(asks for a description)*

**You:** "My trash wasn't collected on Monday morning even though it was out by 7am."

**Agent:** *(calls create_case, confirms a case number)* "I've filed case #1 for you, John. You'll be contacted at 555-867-5309 with an update."

---

## Scenario 2: Checking an Existing Case

**You:** "I want to check the status of my request."

**Agent:** *(asks for your phone number)*

**You:** "555-867-5309"

**Agent:** *(looks up cases)* "I found 1 case for that number. Case #1 — missed service, status: open, filed today."

---

## Scenario 3: Billing Issue

**You:** "I have a question about my bill."

**Agent:** *(asks for your name)*

**You:** "Jane Doe"

**Agent:** *(asks for your phone number)*

**You:** "555-123-4567"

**Agent:** *(asks for issue type)*

**You:** "Billing question"

**Agent:** *(asks for a description)*

**You:** "I was charged twice for water service in April."

**Agent:** "Case #2 has been filed. Someone will follow up at 555-123-4567."

---

## Tips

- Speak clearly and wait for the agent to finish before responding.
- The agent needs **all four pieces of info** before it files a case: name, phone, issue type, description.
- Issue types it recognizes: **missed service**, **billing**, **other**.
- After filing, check the dashboard at `http://localhost:3000` to see the case appear.
