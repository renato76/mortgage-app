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
const compactPounds = (value: number) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1,
}).format(value)

const mortgageProperties = {
  price: { type: 'number', description: 'Property price in pounds.' },
  deposit: { type: 'number', description: 'Deposit amount in pounds.' },
  interestRate: { type: 'number', description: 'Annual interest rate as a percentage.' },
  termYears: { type: 'number', description: 'Mortgage term in whole years.' },
}

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
  {
    type: 'function' as const,
    function: {
      name: 'calculateMortgage',
      description: 'Calculate deterministic mortgage repayment figures from complete mortgage inputs.',
      strict: true,
      parameters: {
        type: 'object',
        properties: mortgageProperties,
        required: ['price', 'deposit', 'interestRate', 'termYears'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compareMortgageScenarios',
      description: 'Compare a baseline mortgage with a scenario. Provide the new absolute value for every input the user wants changed; use null for unchanged inputs. A scenario may change more than one input.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          ...mortgageProperties,
          scenarioPrice: { type: ['number', 'null'], description: 'New offer price in pounds, or null to keep it unchanged.' },
          scenarioDeposit: { type: ['number', 'null'], description: 'New deposit in pounds, or null to keep it unchanged.' },
          scenarioTermYears: { type: ['number', 'null'], description: 'New mortgage term in whole years, or null to keep it unchanged.' },
          scenarioInterestRate: { type: ['number', 'null'], description: 'New annual interest rate as a percentage, or null to keep it unchanged.' },
        },
        required: ['price', 'deposit', 'interestRate', 'termYears', 'scenarioPrice', 'scenarioDeposit', 'scenarioTermYears', 'scenarioInterestRate'],
        additionalProperties: false,
      },
    },
  },
]

type MortgageInputs = {
  price: number
  deposit: number
  interestRate: number
  termYears: number
}

function parseToolArguments(raw: string, expectedFields: readonly string[]) {
  let args: unknown
  try {
    args = JSON.parse(raw)
  } catch {
    throw new MortgageValidationError('The mortgage inputs could not be read. Please try again.')
  }

  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new MortgageValidationError('Provide valid mortgage inputs.')
  }

  const record = args as Record<string, unknown>
  if (
    expectedFields.some((field) => !Object.prototype.hasOwnProperty.call(record, field)) ||
    Object.keys(record).some((field) => !expectedFields.includes(field))
  ) {
    throw new MortgageValidationError('Provide valid mortgage inputs.')
  }

  return record
}

function readMortgageInputs(args: Record<string, unknown>): MortgageInputs {
  const fields = ['price', 'deposit', 'interestRate', 'termYears'] as const
  for (const field of fields) {
    if (typeof args[field] !== 'number' || !Number.isFinite(args[field])) {
      throw new MortgageValidationError('Provide valid numerical mortgage inputs.')
    }
  }

  return {
    price: args.price as number,
    deposit: args.deposit as number,
    interestRate: args.interestRate as number,
    termYears: args.termYears as number,
  }
}

function compareMortgageScenarios(
  inputs: MortgageInputs,
  scenarioInputs: MortgageInputs,
  scenarioType: 'deposit' | 'term' | 'price' | 'rate' | 'multiple',
  scenarioLabel: string
) {
  const originalResults = calculateMortgageDetails(
    inputs.price, inputs.deposit, inputs.interestRate, inputs.termYears
  )
  const scenarioResults = calculateMortgageDetails(
    scenarioInputs.price, scenarioInputs.deposit, scenarioInputs.interestRate, scenarioInputs.termYears
  )

  return {
    originalPrice: inputs.price,
    scenarioType,
    originalInputs: inputs,
    scenarioInputs,
    original: { label: 'Initial scenario', results: originalResults },
    scenario: { label: scenarioLabel, results: scenarioResults },
    delta: {
      monthlyPayment: scenarioResults.monthlyPayment - originalResults.monthlyPayment,
      totalInterest: scenarioResults.interestPaid - originalResults.interestPaid,
      totalCost: scenarioResults.totalCost - originalResults.totalCost,
    },
  }
}

function getStoredMortgageInputs(messages: unknown[]): MortgageInputs | undefined {
  for (const message of [...messages].reverse()) {
    if (!message || typeof message !== 'object' || !('originalInputs' in message)) continue

    const storedInputs = (message as { originalInputs?: unknown }).originalInputs
    if (storedInputs === undefined) continue
    if (!storedInputs || typeof storedInputs !== 'object' || Array.isArray(storedInputs)) {
      throw new MortgageValidationError('The current mortgage scenario is invalid. Please calculate it again.')
    }

    return readMortgageInputs(storedInputs as Record<string, unknown>)
  }
  return undefined
}

function getStoredScenarioInputs(messages: unknown[]): MortgageInputs | undefined {
  for (const message of [...messages].reverse()) {
    if (!message || typeof message !== 'object' || !('scenarioInputs' in message)) continue

    const storedInputs = (message as { scenarioInputs?: unknown }).scenarioInputs
    if (storedInputs === undefined) continue
    if (!storedInputs || typeof storedInputs !== 'object' || Array.isArray(storedInputs)) {
      throw new MortgageValidationError('The current comparison scenario is invalid. Please compare it again.')
    }

    return readMortgageInputs(storedInputs as Record<string, unknown>)
  }
  return undefined
}

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

    if (lastMessage.content.startsWith('CTA_SELECTION:')) {
      const [, type, value] = lastMessage.content.split(':')

      if (type === 'deposit_scenarios' && value === 'show_deposit_options') {
        // Get original inputs to calculate savings for each option
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

        const depositIncreases = [10000, 15000, 20000]
        const pounds = new Intl.NumberFormat('en-GB', {
          style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
        })

        const options = originalInputs
          ? depositIncreases.map((increaseAmount) => {
              const originalResults = calculateMortgageDetails(
                originalInputs.price,
                originalInputs.deposit,
                originalInputs.interestRate,
                originalInputs.termYears
              )
              const newDeposit = originalInputs.deposit + increaseAmount
              const updatedResults = calculateMortgageDetails(
                originalInputs.price,
                newDeposit,
                originalInputs.interestRate,
                originalInputs.termYears
              )
              const monthlySavings = Math.abs(
                updatedResults.monthlyPayment - originalResults.monthlyPayment
              )
              return {
                label: `${pounds.format(increaseAmount)} (save ~${pounds.format(monthlySavings)}/mo)`,
                value: String(increaseAmount),
              }
            })
          : depositIncreases.map((increaseAmount) => ({
              label: `${pounds.format(increaseAmount)}`,
              value: String(increaseAmount),
            }))

        return res.status(200).json({
          state: 'scenario_selection',
          message: 'Choose how much to increase your deposit by:',
          ctaPrompt: {
            question: 'Increase deposit by:',
            type: 'deposit_amount_selection',
            options,
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
            scenarioType: 'deposit',
            originalInputs: { price, deposit, interestRate, termYears },
            scenarioInputs: { price, deposit: newDeposit, interestRate, termYears },
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
    }

    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const hasComparisonIntent = Boolean(latestUserMessage && /\bcompare\b/i.test(latestUserMessage.content))
    const hasScenarioChangeIntent = Boolean(
      latestUserMessage &&
      /\b(?:change|update|adjust|set|try|use|make|increase|decrease|reduce|raise|lower)\b/i.test(latestUserMessage.content) &&
      /\b(?:deposit|term|rate|interest|offer|price)\b/i.test(latestUserMessage.content) &&
      /\d/.test(latestUserMessage.content)
    )
    const hasScenarioContextRequest = hasComparisonIntent || hasScenarioChangeIntent
    const storedInputs = hasScenarioContextRequest ? getStoredMortgageInputs(messages) : undefined
    const storedScenarioInputs = hasScenarioContextRequest ? getStoredScenarioInputs(messages) : undefined
    const forceComparisonTool = Boolean(
      storedInputs && (hasComparisonIntent || (hasScenarioChangeIntent && storedScenarioInputs))
    )

    // If user asks for comparison/scenario change but no baseline exists, guide them to calculate first
    if ((hasComparisonIntent || hasScenarioChangeIntent) && !storedInputs) {
      return res.status(200).json({
        state: 'collecting',
        message: 'To compare scenarios, I first need to calculate a baseline. Please provide:\n\n' +
          '• Property price (£)\n' +
          '• Deposit amount (£)\n' +
          '• Annual interest rate (%)\n' +
          '• Mortgage term (years)\n\n' +
          'For example: "Calculate figures for a £300k property, £50k deposit, 4.5% rate, 25 year term"',
      })
    }

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a UK mortgage assistant. Select exactly one tool: use extractMortgageInputs for general questions or when calculation inputs are missing or ambiguous; use calculateMortgage for a requested mortgage estimate when all inputs are known; use compareMortgageScenarios when the user asks to compare scenarios, explore alternatives, or answer "what if" questions (e.g., "what if I save more for deposit", "compare with a higher interest rate", "if I extended the term", "would a bigger deposit help"). Carry forward user-provided figures across the conversation, applying corrections and clears. Never treat assistant examples as user inputs. Expand k/K as thousands and m/M as millions for prices and deposits. Rates are annual percentages: 3.74% means 3.74. For a first comparison, use the calculated inputs as the baseline and change only requested scenario values. For follow-up changes, preserve the original baseline and carry forward the latest alternative scenario, changing only values the user requests. A single scenario may change multiple inputs. Never invent inputs, calculate figures yourself, or claim lender approval or guaranteed rates. For general questions, use concise UK terminology and do not invent current rates.',
        },
        ...(storedInputs && storedScenarioInputs ? [{
          role: 'system' as const,
          content: `The active comparison baseline is ${JSON.stringify(storedInputs)}. The current alternative scenario is ${JSON.stringify(storedScenarioInputs)}. Apply any requested change to the alternative only; preserve the baseline and all unchanged alternative values.`,
        }] : []),
        ...messages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content as string,
        })),
      ],
      tools,
      tool_choice: forceComparisonTool
        ? { type: 'function', function: { name: 'compareMortgageScenarios' } }
        : 'auto',
      parallel_tool_calls: false,
    })

    const assistantMessage = completion.choices[0]?.message
    const toolCalls = assistantMessage?.tool_calls
    if (!toolCalls || toolCalls.length !== 1 || toolCalls[0].type !== 'function') {
      return res.status(502).json({ error: 'The assistant did not select one supported mortgage action. Please try again.' })
    }

    const toolCall = toolCalls[0]
    const toolName = toolCall.function.name
    const toolFields: Record<string, readonly string[]> = {
      extractMortgageInputs: ['price', 'deposit', 'interestRate', 'termYears', 'intent', 'answer'],
      calculateMortgage: ['price', 'deposit', 'interestRate', 'termYears'],
      compareMortgageScenarios: ['price', 'deposit', 'interestRate', 'termYears', 'scenarioPrice', 'scenarioDeposit', 'scenarioTermYears', 'scenarioInterestRate'],
    }
    const expectedFields = toolFields[toolName]
    if (!expectedFields) {
      return res.status(502).json({ error: 'The assistant selected an unsupported mortgage action. Please try again.' })
    }

    const args = parseToolArguments(toolCall.function.arguments, expectedFields)

    if (toolName === 'extractMortgageInputs') {
      const fields = ['price', 'deposit', 'interestRate', 'termYears'] as const
      for (const field of fields) {
        if (args[field] !== null && (typeof args[field] !== 'number' || !Number.isFinite(args[field]))) {
          throw new MortgageValidationError('Provide valid numerical mortgage inputs.')
        }
      }

      if (!['calculate', 'question'].includes(args.intent as string)) {
        throw new MortgageValidationError('The mortgage request could not be understood. Please try again.')
      }

      if (args.answer !== null && typeof args.answer !== 'string') {
        throw new MortgageValidationError('The mortgage request could not be understood. Please try again.')
      }

      if (args.intent === 'question') {
        if (typeof args.answer !== 'string' || !args.answer.trim()) {
          return res.status(502).json({ error: 'The assistant could not answer your question. Please try again.' })
        }
        return res.status(200).json({ state: 'collecting', message: args.answer })
      }

      if (args.answer !== null) {
        throw new MortgageValidationError('Provide valid mortgage inputs.')
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

      if (args.price === args.deposit) {
        const mortgageResults = calculateMortgageDetails(args.price as number, args.deposit as number)
        return res.status(200).json({
          state: 'complete',
          message: 'Your deposit covers the property price. This is a cash purchase with no mortgage borrowing. Taxes, fees and other purchase costs are not included.',
          mortgageResults,
        })
      }

      const inputs = readMortgageInputs(args)
      const mortgageResults = calculateMortgageDetails(
        inputs.price, inputs.deposit, inputs.interestRate, inputs.termYears
      )
      return res.status(200).json({
        state: 'complete',
        message: "I've calculated your mortgage details.",
        mortgageResults,
        originalInputs: inputs,
        ...(mortgageResults.fundingType === 'mortgage' && {
          ctaPrompt: {
            question: 'Would you like to compare this with a different scenario?',
            type: 'scenario_comparison',
            options: [
              { label: 'Yes, compare', value: 'compare_scenarios' },
              { label: "No, thanks", value: 'decline' },
            ],
          },
        }),
      })
    }

    if (toolName === 'calculateMortgage') {
      const inputs = readMortgageInputs(args)
      const mortgageResults = calculateMortgageDetails(
        inputs.price, inputs.deposit, inputs.interestRate, inputs.termYears
      )
      return res.status(200).json({
        state: 'complete',
        message: mortgageResults.fundingType === 'cash'
          ? 'Your deposit covers the property price. This is a cash purchase with no mortgage borrowing. Taxes, fees and other purchase costs are not included.'
          : "I've calculated your mortgage details.",
        mortgageResults,
        originalInputs: inputs,
        ...(mortgageResults.fundingType === 'mortgage' && {
          ctaPrompt: {
            question: 'Would you like to compare this with a different scenario?',
            type: 'scenario_comparison',
            options: [
              { label: 'Yes, compare', value: 'compare_scenarios' },
              { label: "No, thanks", value: 'decline' },
            ],
          },
        }),
      })
    }

    const inputs = storedInputs ?? readMortgageInputs(args)
    const scenarioInputs = { ...(storedScenarioInputs ?? inputs) }
    const changedFields: Array<'deposit' | 'term' | 'price' | 'rate'> = []

    if (args.scenarioDeposit !== null) {
      if (typeof args.scenarioDeposit !== 'number' || !Number.isFinite(args.scenarioDeposit)) {
        throw new MortgageValidationError('Provide a valid scenario deposit.')
      }
      scenarioInputs.deposit = args.scenarioDeposit
    }
    if (args.scenarioTermYears !== null) {
      if (typeof args.scenarioTermYears !== 'number' || !Number.isFinite(args.scenarioTermYears)) {
        throw new MortgageValidationError('Provide a valid scenario term.')
      }
      scenarioInputs.termYears = args.scenarioTermYears
    }
    if (args.scenarioPrice !== null) {
      if (typeof args.scenarioPrice !== 'number' || !Number.isFinite(args.scenarioPrice)) {
        throw new MortgageValidationError('Provide a valid scenario offer price.')
      }
      scenarioInputs.price = args.scenarioPrice
    }
    if (args.scenarioInterestRate !== null) {
      if (typeof args.scenarioInterestRate !== 'number' || !Number.isFinite(args.scenarioInterestRate)) {
        throw new MortgageValidationError('Provide a valid scenario interest rate.')
      }
      scenarioInputs.interestRate = args.scenarioInterestRate
    }

    if (scenarioInputs.deposit !== inputs.deposit) changedFields.push('deposit')
    if (scenarioInputs.termYears !== inputs.termYears) changedFields.push('term')
    if (scenarioInputs.price !== inputs.price) changedFields.push('price')
    if (scenarioInputs.interestRate !== inputs.interestRate) changedFields.push('rate')

    if (changedFields.length === 0) {
      throw new MortgageValidationError('Choose at least one mortgage value to change.')
    }

    const scenarioType = changedFields.length > 1 ? 'multiple' : changedFields[0]
    const scenarioLabel = [
      ...(changedFields.includes('deposit') ? [`${compactPounds(scenarioInputs.deposit)} deposit`] : []),
      ...(changedFields.includes('term') ? [`${scenarioInputs.termYears}y`] : []),
      ...(changedFields.includes('price') ? [`${compactPounds(scenarioInputs.price)} offer`] : []),
      ...(changedFields.includes('rate') ? [`${scenarioInputs.interestRate}%`] : []),
    ].join(' · ')
    
    const originalResults = calculateMortgageDetails(
      inputs.price,
      inputs.deposit,
      inputs.interestRate,
      inputs.termYears
    )
    const comparison = compareMortgageScenarios(inputs, scenarioInputs, scenarioType, scenarioLabel)
    
    // Build detailed comparison message (same as CTA button flow)
    const delta = {
      monthlyPayment: comparison.delta.monthlyPayment,
      totalInterest: comparison.delta.totalInterest,
      totalCost: comparison.delta.totalCost,
    }
    const pounds = new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
    })
    
    const monthlyDifference = Math.abs(delta.monthlyPayment)
    const direction = delta.monthlyPayment < 0 ? 'reduce' : 'increase'
    const interestExplanation = inputs.interestRate === 0
      ? 'At 0% interest, there is no mortgage interest to save.'
      : `Over the ${inputs.termYears}-year term, you would also ${delta.totalInterest < 0 ? 'save' : 'pay'} approximately ${pounds.format(Math.abs(delta.totalInterest))} in interest.`
    
    const detailedMessage = `Compared with ${scenarioLabel}: your monthly payment would ${direction} by ${pounds.format(monthlyDifference)}. ${interestExplanation} Total cost difference: ${pounds.format(delta.totalCost)}.`
    
    return res.status(200).json({
      state: 'complete',
      message: detailedMessage,
      comparison,
    })
  } catch (error: unknown) {
    if (error instanceof MortgageValidationError) {
      return res.status(400).json({ error: error.message })
    }

    const errorWithCode = error as {
      code?: string
      status?: number
    }
    console.error('Chatbot request failed', {
      code: typeof errorWithCode?.code === 'string' ? errorWithCode.code : undefined,
      status: typeof errorWithCode?.status === 'number' ? errorWithCode.status : undefined,
    })

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
