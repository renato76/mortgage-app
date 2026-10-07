# Mortgage Calculator

A small UK mortgage calculator built with Next.js 15's Pages Router, React, and TypeScript. It provides a conventional form-based estimate and a chat interface that can gather mortgage details and calculate an estimate from a conversation.

## Features

- **Mortgage calculator:** Enter a property price, deposit, annual interest rate, and term to calculate an estimated monthly repayment, total paid, principal, and interest.
- **Chatbot:** Ask mortgage questions conversationally. The assistant requests any missing calculation inputs and can calculate results once it has the property price, deposit, interest rate, and term.
- **Shared results display:** Chatbot calculations appear in the same results panel as calculations from the form.
- **Server-rendered form results:** The form uses a GET request, so its values are represented in the page URL and calculations are performed in `getServerSideProps`.

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

1. The chat component keeps the conversation in React state for as long as that component remains mounted.
2. On send, it posts the conversation to `POST /api/chatbot` as JSON. The browser does not call OpenAI directly.
3. The API route sends the conversation to OpenAI using the `gpt-3.5-turbo` model and provides a `calculateMortgagePayment` function tool. The assistant is instructed to collect the four required values and use UK mortgage terminology and pounds sterling.
4. If the assistant asks a follow-up question, the API returns its message and the chat displays it. When the assistant requests the calculation tool, the API parses the tool arguments, performs the calculation on the server, and returns both a confirmation message and the results.
5. The chat passes those results to the page, which renders them in the mortgage results panel.

The tool is executed directly by the API route; this is not a general-purpose tool-execution loop. The chatbot currently calculates repayment, total cost, capital paid, and interest paid. Although its server calculation also derives an annual remaining balance, that figure is not sent to the chat results panel.

## Project structure

```text
pages/
  index.tsx                    Home page linking to the calculator
  mortgage-calculator.tsx      Calculator form and server-side calculation
  api/chatbot.ts               OpenAI chat endpoint and calculation tool
components/
  Chatbot/Chatbot.tsx          Chat UI and API client
  MortgageResults/             Shared results display
utils/
  calculateRemainingBalance.ts Annual balance schedule helper
styles/
  globals.css                  Global Tailwind styles
```

## Current scope

- The **Remortgage** and **Interest Only** options are displayed in the form, but currently do not change the calculation. Both the form and chatbot use the standard repayment-mortgage formula.
- Form calculations are rendered by the server from URL query values. Chatbot results are held in client state and are not saved; refreshing the page clears the conversation and chat-generated results.
- The chatbot requires a valid `OPENAI_API_KEY`. If the key is missing or the OpenAI request fails, the API route returns an error and the chat displays a generic failure message.
- This is an informational calculator, not financial advice or a mortgage offer. Users should confirm figures with a qualified adviser or lender.