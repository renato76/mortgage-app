import type { NextApiRequest, NextApiResponse } from 'next'
import { OpenAI } from 'openai'
import {
  calculateMortgageDetails,
  MortgageValidationError,
} from '../../utils/calculateMortgageDetails'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'extractMortgageInputs',
      description:
        'Extract the latest user-provided mortgage inputs from the conversation. Return null only for missing or ambiguous values. Do not ask for confirmation or perform calculations.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          price: { type: ['number', 'null'], description: 'Property price in pounds. 430k or 430K means 430000.' },
          deposit: { type: ['number', 'null'], description: 'Deposit amount in pounds. 100k or 100K means 100000.' },
          interestRate: {
            type: ['number', 'null'],
            description: 'Annual interest rate as a percentage. A rate of 3.74% means 3.74, not 0.0374.',
          },
          termYears: {
            type: ['number', 'null'],
            description: 'Mortgage term in years. 23 years means 23.',
          },
          intent: {
            type: 'string',
            enum: ['calculate', 'question'],
            description: 'calculate for supplied or corrected figures, calculation requests, or replies to input questions; question only for general educational questions.',
          },
          answer: {
            type: ['string', 'null'],
            description: 'An answer for a general mortgage question; null for calculation requests. Never ask for calculation inputs here.',
          },
        },
        required: ['price', 'deposit', 'interestRate', 'termYears', 'intent', 'answer'],
        additionalProperties: false,
      },
    },
  },
]

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const messages = req.body?.messages

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.some((message) =>
      !message ||
      typeof message !== 'object' ||
      !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      message.content.trim() === ''
    )
  ) {
    return res.status(400).json({
      error: 'Provide a non-empty conversation containing user or assistant messages.',
    })
  }

  try {
    // HANDLE CTA SELECTIONS FIRST (before calling OpenAI)
    const lastMessage = messages[messages.length - 1]
    console.log('🔍 Last message:', lastMessage.content)

    if (lastMessage.content.startsWith('CTA_SELECTION:')) {
      const [, type, value] = lastMessage.content.split(':')
      console.log('🎯 CTA detected - Type:', type, 'Value:', value)

      if (type === 'deposit_scenarios' && value === 'show_deposit_options') {
        console.log('📋 Showing deposit options menu')
        return res.status(200).json({
          state: 'scenario_selection',
          message: 'Choose how much to increase your deposit by:',
          ctaPrompt: {
            question: 'Increase deposit by:',
            type: 'deposit_amount_selection',
            options: [
              { label: '£10,000', value: '10000' },
              { label: '£15,000', value: '15000' },
              { label: '£20,000', value: '20000' },
            ],
          },
        })
      }

      if (type === 'deposit_amount_selection') {
        if (!['10000', '15000', '20000'].includes(value)) {
          throw new MortgageValidationError('Choose a valid deposit increase.')
        }
        const increaseAmount = Number(value)

        interface Message {
          role: string
          content: string
          originalInputs?: {
            price: number
            deposit: number
            interestRate: number
            termYears: number
          }
        }

        const originalInputs = ([...messages] as Message[])
          .reverse()
          .map((m) => m.originalInputs)
          .find(Boolean)

        if (!originalInputs) {
          return res.status(400).json({
            error: 'Missing original mortgage inputs',
          })
        }

        const { price, deposit, interestRate, termYears } = originalInputs

        // Original calculation
        const originalResults = calculateMortgageDetails(
          price,
          deposit,
          interestRate,
          termYears
        )

        // Updated calculation
        const newDeposit = deposit + increaseAmount

        const updatedResults = calculateMortgageDetails(
          price,
          newDeposit,
          interestRate,
          termYears
        )

        const delta = {
          monthlyPayment: updatedResults.monthlyPayment - originalResults.monthlyPayment,
          totalInterest: updatedResults.interestPaid - originalResults.interestPaid,
          totalCost: updatedResults.totalCost - originalResults.totalCost,
        }
        const pounds = new Intl.NumberFormat('en-GB', {
          style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
        })
        const interestExplanation = interestRate === 0
          ? 'At 0% interest, there is no mortgage interest to save.'
          : `Over the ${termYears}-year term, you would also save approximately ${pounds.format(-delta.totalInterest)} in interest, assuming the rate stays at ${interestRate}%.`
        const cashExplanation = updatedResults.fundingType === 'cash'
          ? ' Your increased deposit covers the full property price, so you would no longer need a mortgage.'
          : ''

        return res.status(200).json({
          state: 'complete',
          message: `You would borrow ${pounds.format(increaseAmount)} less, reducing your monthly repayments by approximately ${pounds.format(-delta.monthlyPayment)}. ${interestExplanation} You would need ${pounds.format(increaseAmount)} more cash upfront.${cashExplanation}`,
          comparison: {
            originalPrice: originalInputs.price,
            original: {
              label: 'Current deposit',
              results: originalResults,
            },
            scenario: {
              label: `Deposit + £${increaseAmount.toLocaleString()}`,
              results: updatedResults,
            },
            delta,
          },
        })
      }
    } else {
      console.log('💬 Normal conversation flow - proceeding to OpenAI')
    }

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a UK mortgage input extractor and assistant. Always call extractMortgageInputs. Extract values supplied by the user across the conversation, keeping earlier supplied values unless the user corrects or clears them. Never treat assistant examples or suggestions as confirmed user inputs. Use intent calculate whenever the user supplies or corrects figures, asks to calculate, or answers an input question. Use intent question only for general educational questions. Expand k/K as thousands and m/M as millions for prices and deposits. Annual rates are percentages: rate 3.74% means interestRate 3.74, and rate 0% means interestRate 0. Example: "calculate figures, price is 430K, deposit is 100K, term 23 years, rate 3.74%" extracts price 430000, deposit 100000, termYears 23, interestRate 3.74, intent calculate, answer null. Example: "property price 430k, deposit 95k, term 23 years, rate 3.65%" extracts price 430000, deposit 95000, termYears 23, interestRate 3.65. Never omit an explicitly supplied percentage or ask the user to confirm obvious numerical relationships. Do not calculate, invent inputs, or ask follow-up questions: the server validates values, determines missing fields, and calculates. Return null for genuinely missing, cleared or ambiguous values. Answer general questions concisely using UK terminology and pounds; do not claim lender approval or invent current rates.',
        },
        ...messages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content as string,
        })),
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'extractMortgageInputs' } },
      parallel_tool_calls: false,
    })

    const assistantMessage = completion.choices[0]?.message

    if (assistantMessage?.tool_calls?.length) {
      const toolCall = assistantMessage.tool_calls[0]

      if (
        toolCall.type === 'function' &&
        toolCall.function.name === 'extractMortgageInputs'
      ) {
        let args
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          throw new MortgageValidationError('The mortgage inputs could not be read. Please confirm your figures.')
        }

        if (!args || typeof args !== 'object' || Array.isArray(args)) {
          throw new MortgageValidationError('Provide valid mortgage inputs.')
        }

        const fields = ['price', 'deposit', 'interestRate', 'termYears'] as const
        for (const field of fields) {
          if (args[field] !== null && (typeof args[field] !== 'number' || !Number.isFinite(args[field]))) {
            throw new MortgageValidationError('Provide valid numerical mortgage inputs.')
          }
        }

        if (!['calculate', 'question'].includes(args.intent)) {
          throw new MortgageValidationError('The mortgage request could not be understood. Please try again.')
        }

        if (args.intent === 'question') {
          if (typeof args.answer !== 'string' || !args.answer.trim()) {
            return res.status(502).json({ error: 'The assistant could not answer your question. Please try again.' })
          }
          return res.status(200).json({ state: 'collecting', message: args.answer })
        }

        const missing = fields.filter((field) => args[field] === null &&
          !(args.price !== null && args.price === args.deposit &&
            (field === 'interestRate' || field === 'termYears')))
        if (missing.length) {
          const questions = {
            price: 'What is the property price (£)?',
            deposit: 'How much is your deposit (£)?',
            interestRate: 'What annual interest rate (%) should I use?',
            termYears: 'What mortgage term should I use, in whole years?',
          }
          return res.status(200).json({ state: 'collecting', message: questions[missing[0]] })
        }

        /**
         * Base mortgage calculation (deterministic)
         */
        const baseResults = calculateMortgageDetails(
          args.price,
          args.deposit,
          args.interestRate ?? undefined,
          args.termYears ?? undefined
        )

        if (baseResults.fundingType === 'cash') {
          return res.status(200).json({
            state: 'complete',
            message: 'Your deposit covers the property price. This is a cash purchase with no mortgage borrowing. Taxes, fees and other purchase costs are not included.',
            mortgageResults: baseResults,
          })
        }

        /**
         * ✅ RETURN BASE RESULTS + CTA (NO SCENARIO YET)
         */
        return res.status(200).json({
          state: 'complete',

          message: "I've calculated your mortgage details.",

          mortgageResults: baseResults,

          ctaPrompt: {
            question:
              'Would you like to see how increasing your deposit affects your monthly payments?',
            type: 'deposit_scenarios',
            options: [
              { label: 'Yes, show me', value: 'show_deposit_options' },
              { label: "No, I'm good", value: 'decline' },
            ],
          },
          originalInputs: {
            price: args.price,
            deposit: args.deposit,
            interestRate: args.interestRate,
            termYears: args.termYears,
          },
        })
      }
    }

    return res.status(502).json({
      error: 'The assistant could not extract your mortgage inputs. Please try again.',
    })
  } catch (error: unknown) {
    if (error instanceof MortgageValidationError) {
      return res.status(400).json({ error: error.message })
    }

    console.error('Chatbot error:', error)

    const errorWithCode = error as {
      code?: string
      status?: number
    }

    if (
      errorWithCode.code === 'model_not_found' ||
      errorWithCode.status === 404
    ) {
      return res.status(400).json({
        error:
          `OpenAI model "${OPENAI_MODEL}" is not available for this account. Set OPENAI_MODEL to a valid model such as "gpt-4o-mini".`,
      })
    }

    return res.status(500).json({
      error: 'Failed to process chatbot request',
    })
  }
}
