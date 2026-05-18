  
Last Updated: April 9, 2026  
    
     

# **EffiGov Engineering Take Home**

## The goal of this take home is to see how quickly you can ship a functional demo under time constraints and ambiguity. 

You will be recreating the basic functionality of the EffiGov voice AI platform: an AI voice agent that intakes service requests, an AI analysis agent that analyzes the calls and extracts structured data, and a dashboard that allows employees to view and triage cases.

You have **3.5 hours**. Given the short timeframe, we’re evaluating architectural judgment, clarity, and functionality more than polish.

## What to build

Create a demo with:

* a voice agent for interacting with residents (*LiveKit* recommended)  
* a backend for processing calls (*FastAPI* *Python* with *uv* dependency management recommended) that writes to a database (*SQLite* is fine)  
* a frontend case management dashboard (*Next.js* recommended)

The system should simulate a customer service workflow. A caller speaks with the voice agent, and the system creates and updates a case that can be viewed in the dashboard.

## Core user flow

A basic successful demo should support this flow:

1. A user starts a voice session with the agent.  
2. The agent can handle a simple customer service interaction, such as:  
   * Reporting an issue  
   * Asking for an update  
   * Providing contact details  
3. The backend creates or updates a case based on the conversation.  
4. The dashboard shows the case and its current status.  
5. The dashboard updates after the interaction without manual database edits.

## Minimum functionality

Please implement the following:

### 1\. Voice agent demo

Build a LiveKit-powered voice interaction that runs locally.

The agent should be able to:

* Greet the user  
* Collect a few pieces of structured information  
* Perform at least one backend action through a tool or API call  
* Respond based on the result

Example actions:

* Create a case  
* Look up an existing case by phone number or case ID  
* Update a case status or note

You can keep the conversation scope narrow. Depth is less important than having a clean end-to-end flow.

### 2\. FastAPI backend

Build a small backend with clear endpoints for case data.

At minimum, support:

* Creating a case  
* Listing cases  
* Getting one case  
* Updating a case field through voice interaction

You may use in-memory storage, SQLite, or anything similarly lightweight. Do not spend time on production-grade infrastructure.

### 3\. Dashboard

Build a simple internal dashboard for managing cases.

It should let a staff user:

* View all cases  
* Open an individual case  
* See key fields such as name, issue, status, and notes  
* Confirm that the voice interaction *changed* the case data

### 4\. Local setup

Your take home demo can be runnable on localhost. Don’t worry about deployments or Docker setups (unless you have templates for these already from other projects that you would like to use).

## Timebox guidance

You only have **3.5 hours**, so prioritize ruthlessly.

A strong submission usually does the basics well:

* One clean voice flow  
* One clean backend model  
* One simple dashboard

Do not waste time on edge cases, heavy styling, or complex architecture unless the basics are already solid.

## Suggested scope

A good example is something like this:

* Caller says they want to report a missed service or request an update  
* Agent collects:  
  * name  
  * phone number  
  * issue type  
  * short description  
* Agent creates a case through the backend  
* Dashboard shows the new case  
* Staff can open the case and update its status.

## Deliverables

Please share source code uploaded to GitHub or emailed as a .zip with [aden@effigov.com](mailto:aden@effigov.com) before the 3.5 hours ends. 

In the call, you’ll demo the system, test functionality, and discuss design decisions.

## FAQs

1. **Can I use AI tools?** Yes. Use them as you normally would. Just make sure you understand the code you submit and can explain it in the follow-up call.  
2. **Does this need to be production-ready?** No. This is a demo only. We care much more about whether it works locally and whether your choices are sensible.  
3. **Does it only need to run on localhost?** Yes. Localhost only is completely fine. You do not need to deploy it.  
4. **Do I need full telephony integration?** No. A local LiveKit voice session is enough.  
5. **Is documentation required?** No. The only evaluation points are 1\) the code and 2\) the demo in the call following the take home.  
6. **Can I use frameworks other than the recommended ones?** Yes \- these are the ones we use, but you may use another framework if you have more experience with it.  
7. **What if I cannot finish everything?** That is expected \- make good tradeoffs. A smaller demo that works is much better than a larger demo that is broken.

## Stretch Goal

(Only work on the stretch goal once the basic functionality is working reasonably well.)

The stretch goal is to add live, responsive features to the dashboard. This will likely involve a websocket between the backend and frontend. You will use this real-time connection to:

* Stream the call transcript into the case details (or a separate view) in real-time.  
* Immediately update the status and additional case fields as new interactions occur.

A strong submission will demonstrate:

* A sensible event model  
* Clean handling of repeated updates  
* A UI that remains understandable while data is changing in real time

Examples of behavior that would make this feel especially polished:

* The case appears in the dashboard as soon as the call starts.  
* The transcript streams in dynamically as the conversation progresses.  
* The issue type field updates once the agent has enough confidence.  
* The status can change multiple times as the interaction progresses.

The stretch goal is primarily evaluating how well you can add significant UI polish while managing state cleanly on the backend.

## Additional Features

(Only do these after completing the core requirements and stretch goal.)

Good additional features may be:

* Search or filtering on cases  
* Background / supervisory agent that monitors for misinformation and injects correct information or transfers call to human  
* Call summary generated after the interaction  
* Audit logs of case changes displayed on the dashboard

Keep additional features **product** focused, not infra/tooling focused.

## Submission advice

Don’t try to cover too much surface area. The winning strategy is:

* pick one narrow workflow  
* make it work end to end  
* keep the code easy to follow

## Resources

1. [**A complete voice AI starter for LiveKit Agents with Python**](https://github.com/livekit-examples/agent-starter-python)  
2. [**Install uv**](https://docs.astral.sh/uv/getting-started/installation/)  
3. [**FastAPI docs**](https://fastapi.tiangolo.com/)  
4. [**NextJS docs**](https://nextjs.org/docs/app/getting-started/installation)

