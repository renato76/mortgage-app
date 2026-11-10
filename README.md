# Mortgage Assistant

A conversational UK mortgage assistant built with Next.js 15's Pages Router, React, and TypeScript. Chat naturally with an AI assistant to explore mortgage scenarios, compare options, and get detailed financial breakdowns through an intuitive conversational flow.

## Features

- **Conversational input collection:** Chat-based wizard collects property price, deposit, mortgage term, and interest rate with smart validation and easy error correction
- **Scenario comparison:** Compare different mortgage scenarios side-by-side with monthly repayment changes, total interest differences, and detailed comparison tables
- **Input validation:** Real-world constraints for property price (£50k-£2m), minimum deposit (10%), term (5-30 years), and interest rates (0.5-10%)
- **Scenario suggestions:** Bot suggests pre-filled scenarios (e.g., "What if I increase deposit by £10k?" or "5% interest rate and 25 year term")
- **Mobile-first responsive design:** Fully responsive UI with stacked input/button layout across all screen sizes
- **Modern chat interface:** Clean, minimalist chat bubbles inspired by contemporary messaging apps (no avatars)
- **Affordability prompts:** After each comparison, users can explore affordability based on income and outgoings
- **Easy corrections:** "Go Back" button allows users to change any previously entered value without restarting

## Run locally

Requirements: Node.js and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add an OpenAI API key to a local environment file named `.env.local`:

   ```env
   OPENAI_API_KEY=your_openai_api_key
   ```

   The key is read only by the server-side API route. Do not expose it through a `NEXT_PUBLIC_` variable or commit it to source control.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), then choose **Go to Mortgage Calculator**.

Other available scripts:

```bash
npm run build
npm start
npm run lint
```

`npm start` serves a production build, so run `npm run build` first.

## How the calculator works

The form on `/mortgage-calculator` submits `price`, `deposit`, `interestRate`, and `termYears` as query parameters. For example:

```text
/mortgage-calculator?price=200000&deposit=20000&interestRate=5&termYears=30
```

`getServerSideProps` reads and validates those values, then calculates the loan amount, monthly repayment, total cost, capital paid, interest paid, and an annual remaining-balance schedule. The results component currently displays the first four figures; the remaining-balance schedule is calculated but not displayed.

The repayment calculation assumes a fixed annual interest rate and regular monthly repayments over the full term. It is an estimate and does not include fees, taxes, insurance, rate changes, or lender-specific affordability rules.

## How the chatbot works

1. The chat component (`Chatbot.tsx`) manages conversation state in React, including inputStage tracking for the multi-phase input collection
2. During input collection (price → deposit → term → rate), the component validates locally with sensible business rules
3. Smart input parser handles natural phrases like "deposit 90k" or "price 450000" without requiring exact keywords
4. "Go Back" button lets users change any previous input by showing an edit menu (CTA type: `edit_inputs`)
5. Once all 4 values are collected, the chat posts them to `POST /api/chatbot` along with conversation history
6. The API route sends the request to OpenAI using the `gpt-3.5-turbo` model and provides `calculateMortgagePayment` and `compareMortgageScenario` function tools
7. When the assistant uses a tool, the API performs the calculation server-side and returns results
8. Results appear in the right panel; chat shows a dynamic benefit message explaining the comparison
9. After comparison results, an affordability prompt offers "Explore affordability" or "Try another scenario"
10. "Try another scenario" shows suggestion examples; "Explore affordability" is placeholder for future feature

## Input validation

The chatbot validates all inputs before sending to OpenAI:

- **Property price:** £50,000 - £2,000,000 (typical UK market range)
- **Deposit:** Minimum 10% of property price (standard lender requirement)
- **Mortgage term:** 5-30 years (UK lender constraints)
- **Interest rate:** 0.5-10% (realistic market range including edge cases)

Validation happens client-side during input collection. If a value is out of range, the bot shows a helpful message with the valid range and asks the user to try again.

## Smart input parsing

The parser extracts numbers from natural phrases:
- "deposit 90k" → 90,000
- "price 450000" → 450,000
- "25 years" → 25
- "4.5 percent" → 4.5

Users can also enter values with K/M suffixes: "450k", "2.5m", etc.

## Project structure

```text
pages/
  index.tsx                    Home page with links to mortgage assistant
  mortgage-assistant.tsx       Main app: chatbot + results panel with tabs
  api/chatbot.ts               OpenAI chat endpoint and calculation tools
components/
  Chatbot/Chatbot.tsx          Chat UI, input collection, validation, and API client
  MortgageResults/             Results display component (shared by chat)
utils/
  calculateRemainingBalance.ts Annual balance schedule helper
styles/
  assistant.module.css         Responsive layout, chat styling, mobile breakpoints
```

## Current scope

- Results are held in client state and not persisted; refreshing the page clears chat history
- Chatbot requires a valid `OPENAI_API_KEY` in `.env.local`; missing or invalid keys cause graceful error messages
- Affordability feature is placeholder; future implementation planned
- This is an informational calculator, not financial advice or a mortgage offer. Users should confirm figures with a qualified adviser or lender.