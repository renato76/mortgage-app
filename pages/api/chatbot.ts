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

/**
 * OpenAI function definition
 * Used ONLY to detect when base mortgage info is complete
 */
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'calculateMortgagePayment',
      description:
        'Calculate UK mortgage payments using property price, deposit, interest rate and term. For a fully cash-funded purchase, only property price and deposit are needed.',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number', exclusiveMinimum: 0, description: 'Property price in £' },
          deposit: { type: 'number', minimum: 0, description: 'Deposit amount in £, no greater than the property price' },
          interestRate: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Annual interest rate percentage (e.g. 5.5)',
          },
          termYears: {
            type: 'integer',
            minimum: 1,
            maximum: 40,
            description: 'Mortgage term in years (e.g. 25)',
          },
        },
        required: ['price', 'deposit'],
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

        return res.status(200).json({
          state: 'complete',
          message: `Here's how increasing your deposit by £${increaseAmount.toLocaleString()} affects your mortgage.`,
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
            delta: {
              monthlyPayment:
                updatedResults.monthlyPayment - originalResults.monthlyPayment,
              totalInterest:
                updatedResults.interestPaid - originalResults.interestPaid,
              totalCost: updatedResults.totalCost - originalResults.totalCost,
            },
          },
        })
      }
    } else {
      console.log('💬 Normal conversation flow - proceeding to OpenAI')
    }

    /**
     * NORMAL FLOW: Ask OpenAI what to do next
     * - ask for missing info
     * - OR call calculateMortgagePayment
     */
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful UK mortgage assistant. Ask conversationally for missing information; never guess values. For a mortgage, collect property price (£), deposit (£), interest rate (0-100%), and term (1-40 whole years) before calling calculateMortgagePayment. If the deposit equals the price, call the tool with just price and deposit for a cash purchase. Deposits must be between zero and the price. Use UK terminology and £.',
        },
        ...messages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content as string,
        })),
      ],
      tools,
      tool_choice: 'auto',
    })

    const assistantMessage = completion.choices[0].message

    /**
     * CASE 1: OpenAI decides base mortgage info is complete
     */
    if (assistantMessage.tool_calls?.length) {
      const toolCall = assistantMessage.tool_calls[0]

      if (
        toolCall.type === 'function' &&
        toolCall.function.name === 'calculateMortgagePayment'
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

        /**
         * Base mortgage calculation (deterministic)
         */
        const baseResults = calculateMortgageDetails(
          args.price,
          args.deposit,
          args.interestRate,
          args.termYears
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

    /**
     * CASE 2: OpenAI is still collecting base inputs
     */
    return res.status(200).json({
      state: 'collecting',
      message: assistantMessage.content,
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
