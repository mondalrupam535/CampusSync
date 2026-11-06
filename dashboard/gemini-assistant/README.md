# CampusSync Gemini assistant

The assistant, Gemini API service, and site integration live in this workspace. The local service serves the CampusSync pages and the `/assistant-chat` endpoint from the same origin.

## Run the website and assistant

1. Copy `.env.example` to `.env` in this folder and add your Gemini API key:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3000
   ```

2. From this folder, install dependencies and start the app:

   ```powershell
   npm.cmd install
   npm.cmd start
   ```

3. Open `http://localhost:3000`. The server opens the Announcements page. The assistant widget is available on each CampusSync page.

The announcement and inbox composers use Gemini to polish the message, then pass the optimized text to the local Java department router for recipient selection. Inbox optimization produces a formal email for a personal recipient and a formal application/request letter for a department recipient, with an editable `[Your Name]` signature placeholder when the sender has not supplied one. Inbox personal-recipient suggestions come from other registered CampusSync accounts; department suggestions are available from the shared department catalog even when no other accounts are registered. Messages to a selected person or department do not require AI department routing. Build the router in `C:\Users\RUPAM\Desktop\dept` with `.\maven\bin\mvn.cmd -q package` before using AI composition. By default, the service looks for `dept\target\department-router-1.0-shaded.jar` alongside the `Java Project` and `dept` folders; set `DEPARTMENT_ROUTER_JAR` if the jar is elsewhere. Set `JAVA_COMMAND` if Java is not available as `java` on `PATH`. The composers continue through the site's existing approval workflow; this demo does not deliver messages to department systems.

On the Events page, upload a university-calendar PDF (up to 15 MB) to extract dated events with Gemini. The PDF and extracted entries are saved in the ignored `data/university-calendar/` folder, reused when the page is reopened, and can be replaced or deleted from the page. A failed replacement leaves the current calendar in place.

Department and academic-unit choices for event proposals, room bookings, and manual recipient selection are maintained in the workspace-level `departments.js` catalog. AI recipient suggestions come from the Java router's `departments.json` and `routing-rules.json`; the neural model returns no more than five confident matches.

Keep `.env` local and never commit API keys.
