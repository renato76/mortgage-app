import type { NextApiRequest, NextApiResponse } from 'next'
import { OpenAI } from 'openai'
import { calculateRemainingBalance } from '@/utils/calculateRemainingBalance'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Same calculation logic as your getServerSideProps
function calculateMortgageDetails(
  price: number,
  deposit: number,
  interestRate: number,
  termYears: number
) {
  const loanAmount = price - deposit
  const rate = interestRate / 100 / 12
  const numberOfMonths = termYears * 12

  const monthlyPayment =
    (loanAmount * rate) / (1 - Math.pow(1 + rate, -numberOfMonths))
  const totalCost = monthlyPayment * numberOfMonths
  const capitalPaid = loanAmount
  const interestPaid = totalCost - capitalPaid

  const remainingBalance = calculateRemainingBalance(
    loanAmount,
    rate,
    numberOfMonths / 12
  )

  return {
    monthlyPayment,
    totalCost,
    capitalPaid,
    interestPaid,
    remainingBalance,
  }
}

const functions = [
  {
    type: 'function' as const,
    function: {
      name: 'calculateMortgagePayment',
      description:
        'Calculate UK mortgage payments when user provides ALL required info: property price, deposit, interest rate and term',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number', description: 'Property price in £' },
          deposit: { type: 'number', description: 'Deposit amount in £' },
          interestRate: {
            type: 'number',
            description: 'Annual interest rate as percentage (e.g. 5.5)',
          },
          termYears: {
            type: 'number',
            description: 'Loan term in years (e.g. 25)',
          },
        },
        required: ['price', 'deposit', 'interestRate', 'termYears'],
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

  const { messages } = req.body

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful UK mortgage advisor. To calculate mortgage payments, you need: property price (£), deposit (£), interest rate (%), and loan term (years). Ask for missing information conversationally. Once you have ALL four, use the calculateMortgagePayment function. Use £ currency and UK terminology.',
        },
        ...messages,
      ],
      tools: functions,
      tool_choice: 'auto',
    })

    const message = completion.choices[0].message

    // Check if AI has all info and wants to calculate
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0]

      if (
        toolCall.type === 'function' &&
        toolCall.function.name === 'calculateMortgagePayment'
      ) {
        const args = JSON.parse(toolCall.function.arguments)
        console.log('Calculating mortgage with:', args)

        // Actually calculate the mortgage
        const results = calculateMortgageDetails(
          args.price,
          args.deposit,
          args.interestRate,
          args.termYears
        )

        // Return results that frontend can use for MortgageResults component
        res.status(200).json({
          reply: {
            role: 'assistant',
            content:
              "Perfect! I've calculated your mortgage details based on the information you provided.",
          },
          mortgageResults: results,
        })
      } else {
        res.status(200).json({ reply: message })
      }
    } else {
      // AI is still asking for more information
      res.status(200).json({ reply: message })
    }
  } catch (error) {
    console.error('OpenAI error:', error)
    res.status(500).json({
      error: 'Failed to fetch response',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
