import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import styles from '@/styles/assistant.module.css'

export interface MortgageInputs {
  price: number
  deposit: number
  interestRate: number
  termYears: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  originalInputs?: MortgageInputs
  scenarioInputs?: MortgageInputs
}

export interface ChatbotMortgageResults {
  fundingType?: 'mortgage' | 'cash'
  purchasePrice?: number
  monthlyPayment: number
  totalCost: number
  capitalPaid: number
  interestPaid: number
  remainingBalance?: Array<{ year: number; balance: number }>
}

export interface MortgageComparison {
  originalPrice: number
  scenarioType: 'deposit' | 'term' | 'price' | 'rate' | 'multiple'
  originalInputs: MortgageInputs
  scenarioInputs: MortgageInputs
  original: {
    label: string
    results: ChatbotMortgageResults
  }
  scenario: {
    label: string
    results: ChatbotMortgageResults
  }
  delta: {
    monthlyPayment: number
    totalInterest: number
    totalCost: number
  }
}

interface ChatbotProps {
  setChatbotResults: (results: ChatbotMortgageResults, originalInputs?: MortgageInputs) => void
  setComparison: (comparison: MortgageComparison) => void
  initialInputs?: MortgageInputs | null
}

interface CtaPromptOption {
  label: string
  value: string
  description?: string
}

interface CtaPrompt {
  question: string
  type: string
  options: CtaPromptOption[]
}

const Chatbot = ({ setChatbotResults, setComparison, initialInputs }: ChatbotProps) => {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ctaPrompt, setCtaPrompt] = useState<CtaPrompt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failedMessages, setFailedMessages] = useState<ChatMessage[] | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [errorType, setErrorType] = useState<'transient' | 'permanent' | null>(null)
  
  // Input collection state
  const [inputStage, setInputStage] = useState<'welcome' | 'price' | 'deposit' | 'term' | 'rate' | 'complete' | 'comparison_prompt' | 'comparison_results'>('welcome')
  const [collectedInputs, setCollectedInputs] = useState<Partial<MortgageInputs>>({})
  
  const requestInFlight = useRef(false)
  const chatLogRef = useRef<HTMLDivElement>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const sendButtonRef = useRef<HTMLButtonElement>(null)

  // Store last known mortgage inputs
  const [lastInputs, setLastInputs] = useState<MortgageInputs | null>(null)
  const [comparisonContext, setComparisonContext] = useState<{
    originalInputs: MortgageInputs
    scenarioInputs: MortgageInputs
  } | null>(null)

  const welcomeMessage = `Welcome to your Mortgage Assistant

I can help you explore different mortgage scenarios.

To get started, I will require these four details:
• Property price
• Deposit
• Mortgage term
• Interest rate

So first of all, what's the property price?`

useEffect(() => {
  if (messages.length === 0) {
    setMessages([
      {
        role: 'assistant',
        content: welcomeMessage,
      },
    ])
    setInputStage('price')
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

  // Show example questions when results are calculated
  useEffect(() => {
    if (initialInputs && inputStage === 'complete' && !ctaPrompt) {
      setLastInputs(initialInputs)
      setComparisonContext({ originalInputs: initialInputs, scenarioInputs: initialInputs })
      
      const depositQuestion = `What if I increase my deposit to £${initialInputs.deposit + 30000}?`
      const rateQuestion = `What if the interest rate was ${initialInputs.interestRate + 1}%?`
      const termQuestion = `What if I chose a ${initialInputs.termYears - 5} year term instead?`
      const priceQuestion = `What if the property price was £${initialInputs.price + 50000}?`
      
      setCtaPrompt({
        question: 'Example questions you can ask:',
        type: 'initial_suggestions',
        options: [
          { label: depositQuestion, value: depositQuestion },
          { label: rateQuestion, value: rateQuestion },
          { label: termQuestion, value: termQuestion },
          { label: priceQuestion, value: priceQuestion }
        ]
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInputs?.price, initialInputs?.deposit, initialInputs?.interestRate, initialInputs?.termYears, ctaPrompt])

  // Auto-scroll chat log to bottom when messages or CTA changes
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
    }
  }, [messages, ctaPrompt])

  // Clean up retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  // Focus input after bot responds (for keyboard users)
  useEffect(() => {
    if (!loading && messages.length > 0 && messageInputRef.current) {
      // Only auto-focus if user hasn't selected a CTA button
      if (!ctaPrompt) {
        messageInputRef.current.focus()
      }
    }
  }, [messages, ctaPrompt, loading])

  // Map error messages to user-friendly text and classify as transient/permanent
  const getErrorInfo = (error: unknown): { message: string; type: 'transient' | 'permanent' } => {
    if (!(error instanceof Error)) {
      return {
        message: 'Something went wrong. Please check your connection and try again.',
        type: 'transient',
      }
    }

    const errorMsg = error.message.toLowerCase()

    // Transient errors (worth retrying)
    if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      return {
        message: 'Network connection error. Retrying automatically...',
        type: 'transient',
      }
    }
    if (errorMsg.includes('timeout')) {
      return {
        message: 'Request timed out. Retrying automatically...',
        type: 'transient',
      }
    }
    if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      return {
        message: 'API is busy. Retrying in a moment...',
        type: 'transient',
      }
    }
    if (errorMsg.includes('unreadable response')) {
      return {
        message: 'Server returned an invalid response. Retrying...',
        type: 'transient',
      }
    }
    if (errorMsg.includes('empty response')) {
      return {
        message: 'Server returned no data. Retrying...',
        type: 'transient',
      }
    }

    // Permanent errors (don't retry automatically)
    if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
      return {
        message: `Invalid input: ${error.message}. Please correct and try again.`,
        type: 'permanent',
      }
    }
    if (errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
      return {
        message: 'Authentication failed. The mortgage assistant is not configured.',
        type: 'permanent',
      }
    }
    if (errorMsg.includes('forbidden') || errorMsg.includes('403')) {
      return {
        message: 'Access denied. Please contact support.',
        type: 'permanent',
      }
    }

    // Default: assume transient for safety
    return {
      message: error.message || 'An error occurred. Please try again.',
      type: 'transient',
    }
  }

  // Retry with exponential backoff
  const retryWithBackoff = (messages: ChatMessage[], attempt: number = 0) => {
    if (attempt >= 3) {
      // Max retries reached, give up
      setRetryCount(0)
      setErrorType('permanent')
      return
    }

    const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
    setRetryCount(attempt + 1)

    retryTimeoutRef.current = setTimeout(() => {
      submitMessages(messages, attempt + 1)
    }, delay)
  }

  const submitMessages = async (newMessages: ChatMessage[], retryAttempt: number = 0) => {
    if (requestInFlight.current) return
    requestInFlight.current = true

    setMessages(newMessages)
    setLoading(true)
    setError(null)
    setErrorType(null)
    setFailedMessages(null)
    setCtaPrompt(null) // clear previous CTA

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      let data
      try {
        data = await res.json()
      } catch {
        throw new Error('The server returned an unreadable response. Please try again.')
      }

      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Your message could not be processed. Please try again.'
        )
      }

      if (!data || (!data.message && !data.mortgageResults && !data.comparison && !data.ctaPrompt)) {
        throw new Error('The server returned an empty response. Please try again.')
      }

      if (data.message) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: data.message },
        ])
      }
      if (data.mortgageResults && data.state === 'complete') {
        setChatbotResults(data.mortgageResults, data.originalInputs)
        setLastInputs(data.originalInputs || null)
        setComparisonContext(null)
      }

      if (data.comparison) {
        setInputStage('comparison_results')
        setComparison(data.comparison)
        setComparisonContext({
          originalInputs: data.comparison.originalInputs,
          scenarioInputs: data.comparison.scenarioInputs,
        })
        
        // Show affordability prompt after comparison
        const delta = data.comparison.delta
        const scenarioType = data.comparison.scenarioType
        
        let benefit = ''
        if (scenarioType === 'deposit' && delta.monthlyPayment < 0) {
          const depositDifference = data.comparison.scenarioInputs.deposit - data.comparison.originalInputs.deposit
          benefit = `${depositDifference > 0 ? 'Increasing' : 'Reducing'} your deposit by £${Math.abs(depositDifference).toLocaleString()} reduces your monthly repayments and overall interest.`
        } else if (scenarioType === 'rate' && delta.monthlyPayment < 0) {
          const rateChange = data.comparison.scenarioInputs.interestRate < data.comparison.originalInputs.interestRate ? 'lower' : 'higher'
          benefit = `A ${rateChange} interest rate of ${data.comparison.scenarioInputs.interestRate}% reduces your monthly repayments and overall interest.`
        } else if (scenarioType === 'term') {
          benefit = `Here's how a ${data.comparison.scenarioInputs.termYears} year mortgage term compares.`
        } else if (scenarioType === 'price' && delta.monthlyPayment < 0) {
          benefit = `This scenario improves your mortgage outcomes.`
        }
        
        if (benefit) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Great! ${benefit}\n\nWould you also like to explore whether this mortgage could be affordable based on your income and monthly outgoings?`
          }])
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Would you like to explore whether this mortgage could be affordable based on your income and monthly outgoings?'
          }])
        }
        
        setCtaPrompt({
          question: '',
          type: 'affordability_prompt',
          options: [
            { label: 'Explore affordability', value: 'explore_affordability' },
            { label: 'Try another scenario', value: 'try_another_scenario' }
          ]
        })
      } else if (data.ctaPrompt) {
        // Skip scenario_comparison CTA - show suggestions directly instead
        if (data.ctaPrompt.type === 'scenario_comparison') {
          setInputStage('comparison_prompt')
          setMessages(prev => [...prev, 
            {
              role: 'assistant',
              content: 'Would you like to compare this with another scenario?'
            },
            {
              role: 'assistant',
              content: 'Try a different rate, term or deposit. Here are some examples:\n\n• 5% interest rate and 25 year term\n• What if I increase deposit by £10k?\n• 4.5% interest and £10k extra deposit'
            }
          ])
          setCtaPrompt(null)
        } else {
          setCtaPrompt(data.ctaPrompt)
        }
      }

      // Clear retry state on success
      setRetryCount(0)
    } catch (error) {
      const { message, type } = getErrorInfo(error)
      setError(message)
      setErrorType(type)
      setFailedMessages(newMessages)

      // Auto-retry for transient errors
      if (type === 'transient' && retryAttempt < 3) {
        retryWithBackoff(newMessages, retryAttempt)
      }
    } finally {
      requestInFlight.current = false
      setLoading(false)
    }
  }

  const sendMessage = async (userInput?: string, extra?: MortgageInputs) => {
    if (requestInFlight.current) return
    const messageToSend = userInput ?? input
    if (!messageToSend.trim()) return

    setInput('')
    
    // Handle input collection stage
    if (inputStage === 'price' || inputStage === 'deposit' || inputStage === 'term' || inputStage === 'rate') {
      // Check for "go back", "change", "start over" commands
      const lowerInput = messageToSend.toLowerCase()
      if (lowerInput.includes('back') || lowerInput.includes('change') || lowerInput.includes('start over') || lowerInput.includes('restart') || lowerInput === 'go back') {
        setMessages(prev => [...prev, 
          { role: 'user', content: messageToSend },
          { role: 'assistant', content: 'What would you like to do?\n\n• Start over with new numbers\n• Change the property price\n• Change the deposit\n• Change the mortgage term\n• Change the interest rate' }
        ])
        return
      }
      
      // Smart parser: extract number from phrases like "deposit 90k", "price 450k", etc.
      let numValue = parseFloat(messageToSend)
      const messageLower = messageToSend.toLowerCase()
      
      // If the message contains stage keywords, extract just the number
      const stageKeywords = {
        'price': ['price', 'property', 'property price', 'offer'],
        'deposit': ['deposit', 'down payment'],
        'term': ['term', 'years', 'mortgage term'],
        'rate': ['rate', 'interest', 'annual']
      }
      
      if (stageKeywords[inputStage as keyof typeof stageKeywords].some(kw => messageLower.includes(kw))) {
        // Extract the first number from the message
        const numberMatch = messageToSend.match(/[\d.]+/g)
        if (numberMatch) {
          numValue = parseFloat(numberMatch[0])
        }
      }
      
      // Handle K (thousands) and M (millions) suffixes
      if (messageToSend.toUpperCase().includes('K')) {
        numValue = parseFloat(messageToSend) * 1000
      } else if (messageToSend.toUpperCase().includes('M')) {
        numValue = parseFloat(messageToSend) * 1000000
      }
      
      if (isNaN(numValue) || numValue <= 0) {
        setMessages(prev => [...prev, 
          { role: 'user', content: messageToSend },
          { role: 'assistant', content: `I need a valid number for ${inputStage}. For example, try '${inputStage === 'price' ? '450000' : inputStage === 'deposit' ? '90000' : inputStage === 'term' ? '25' : '4.5'}' or '${inputStage === 'price' ? '450k' : inputStage === 'deposit' ? '90k' : inputStage === 'term' ? '25' : '4.5'}'.` }
        ])
        return
      }
      
      // Validation: property price range (£50k - £2m)
      if (inputStage === 'price') {
        const MIN_PRICE = 50000
        const MAX_PRICE = 2000000
        if (numValue < MIN_PRICE || numValue > MAX_PRICE) {
          setMessages(prev => [...prev, 
            { role: 'user', content: messageToSend },
            { role: 'assistant', content: `Property prices typically range from £${MIN_PRICE.toLocaleString()} to £${MAX_PRICE.toLocaleString()}. Please enter a price within this range.` }
          ])
          return
        }
      }
      
      // Validation: minimum 10% deposit
      if (inputStage === 'deposit' && collectedInputs.price && collectedInputs.price > 0) {
        const propertyPrice = collectedInputs.price
        const minDeposit = propertyPrice * 0.1
        if (numValue < minDeposit) {
          setMessages(prev => [...prev, 
            { role: 'user', content: messageToSend },
            { role: 'assistant', content: `That's £${numValue.toLocaleString()}, but you need at least 10% of the property price as a deposit. For a £${propertyPrice.toLocaleString()} property, that's a minimum of £${Math.round(minDeposit).toLocaleString()}. What deposit would you like to use?` }
          ])
          return
        }
      }
      
      // Validation: mortgage term range (5-30 years)
      if (inputStage === 'term') {
        const MIN_TERM = 5
        const MAX_TERM = 30
        if (numValue < MIN_TERM || numValue > MAX_TERM) {
          setMessages(prev => [...prev, 
            { role: 'user', content: messageToSend },
            { role: 'assistant', content: `Mortgage terms typically range from ${MIN_TERM} to ${MAX_TERM} years. Please enter a term within this range.` }
          ])
          return
        }
      }
      
      // Validation: interest rate range (0.5% - 10%)
      if (inputStage === 'rate') {
        const MIN_RATE = 0.5
        const MAX_RATE = 10
        if (numValue < MIN_RATE || numValue > MAX_RATE) {
          setMessages(prev => [...prev, 
            { role: 'user', content: messageToSend },
            { role: 'assistant', content: `Interest rates typically range from ${MIN_RATE}% to ${MAX_RATE}%. Please enter a rate within this range.` }
          ])
          return
        }
      }
      
      // Store the input
      const newCollected = { ...collectedInputs }
      if (inputStage === 'price') newCollected.price = numValue
      if (inputStage === 'deposit') newCollected.deposit = numValue
      if (inputStage === 'term') newCollected.termYears = numValue
      if (inputStage === 'rate') newCollected.interestRate = numValue
      
      setCollectedInputs(newCollected)
      
      // Add user message
      setMessages(prev => [...prev, { role: 'user', content: messageToSend }])
      
      // Check if we have all 4 inputs
      if (inputStage === 'rate' && newCollected.price && newCollected.deposit && newCollected.termYears && newCollected.interestRate) {
        // All inputs collected - calculate
        setInputStage('complete')
        const fullInputs = newCollected as MortgageInputs
        const calcMessage = `calculate price £${fullInputs.price}, deposit £${fullInputs.deposit}, term ${fullInputs.termYears} years, rate ${fullInputs.interestRate}%`
        await submitMessages([...messages, { role: 'user', content: messageToSend }, { role: 'user', content: calcMessage }])
        return
      }
      
      // Move to next stage
      const nextStageMap: Record<'price' | 'deposit' | 'term' | 'rate', 'deposit' | 'term' | 'rate'> = {
        'price': 'deposit',
        'deposit': 'term',
        'term': 'rate',
        'rate': 'rate'
      }
      const nextStage = nextStageMap[inputStage]
      setInputStage(nextStage)
      
      // Ask for next input
      const prompts: Record<'deposit' | 'term' | 'rate', string> = {
        'deposit': `Great! That's £${numValue.toLocaleString()}. Now, what's your deposit?`,
        'term': `Got it, £${numValue.toLocaleString()}. What's the mortgage term in years?`,
        'rate': `Perfect, ${numValue} years. What's the interest rate (annual %)?`
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: prompts[nextStage] }])
      return
    }
    
    // After calculation, normal chatbot mode
    const currentInputs = extra || comparisonContext?.originalInputs || lastInputs
    const messageObj: ChatMessage = currentInputs
      ? {
          role: 'user',
          content: messageToSend,
          originalInputs: currentInputs,
          ...(comparisonContext && { scenarioInputs: comparisonContext.scenarioInputs }),
        }
      : { role: 'user', content: messageToSend }

    await submitMessages([...messages, messageObj])
  }

  const handleCtaSelection = (value: string) => {
    if (!value || !ctaPrompt) return
    
    // If they want to compare scenarios, show helpful suggestions
    if (ctaPrompt.type === 'scenario_comparison' && value === 'compare_scenarios') {
      setInput('')
      
      // Add a bot message with example questions as text
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Try a different rate, term or deposit. Here are some examples:\n\n• 5% interest rate and 25 year term\n• What if I increase deposit by £10k?\n• 4.5% interest and £10k extra deposit'
      }])
      
      // Clear CTA so input field is visible
      setCtaPrompt(null)
      setInputStage('comparison_prompt')
      
      return
    }
    
    // Handle edit inputs menu
    if (ctaPrompt.type === 'edit_inputs') {
      if (value === 'restart') {
        setCollectedInputs({})
        setInputStage('price')
        setCtaPrompt(null)
        setMessages(prev => [...prev, 
          { role: 'user', content: 'Start over' },
          { role: 'assistant', content: 'Great! Let\'s start fresh.\n\nSo first of all, what\'s the property price?' }
        ])
        return
      }
      
      const stageMap: Record<string, 'price' | 'deposit' | 'term' | 'rate'> = {
        'change_price': 'price',
        'change_deposit': 'deposit',
        'change_term': 'term',
        'change_rate': 'rate'
      }
      
      const newStage = stageMap[value]
      if (newStage) {
        setInputStage(newStage)
        setCtaPrompt(null)
        
        const prompts: Record<'price' | 'deposit' | 'term' | 'rate', string> = {
          'price': 'What\'s the property price?',
          'deposit': 'What\'s your deposit?',
          'term': 'What\'s the mortgage term in years?',
          'rate': 'What\'s the interest rate (annual %)?'
        }
        
        setMessages(prev => [...prev, 
          { role: 'user', content: `Change the ${newStage}` },
          { role: 'assistant', content: prompts[newStage] }
        ])
      }
      return
    }
    
    // Handle try another scenario - show comparison suggestions
    if (ctaPrompt.type === 'affordability_prompt' && value === 'try_another_scenario') {
      setInput('')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Try a different rate, term or deposit. Here are some examples:\n\n• 5% interest rate and 25 year term\n• What if I increase deposit by £10k?\n• 4.5% interest and £10k extra deposit'
      }])
      
      setCtaPrompt(null)
      setInputStage('comparison_prompt')
      
      return
    }
    
    // Handle explore affordability - ask which scenario
    if (ctaPrompt.type === 'affordability_prompt' && value === 'explore_affordability') {
      setMessages(prev => [...prev, {
        role: 'user',
        content: 'Explore affordability'
      }, {
        role: 'assistant',
        content: 'Which scenario would you like to check for affordability?'
      }])
      
      setCtaPrompt({
        question: '',
        type: 'scenario_selection_affordability',
        options: [
          { 
            label: 'Initial scenario', 
            value: 'affordability_original',
            description: comparisonContext ? `£${comparisonContext.originalInputs.price.toLocaleString()}, £${comparisonContext.originalInputs.deposit.toLocaleString()} deposit, ${comparisonContext.originalInputs.termYears} years @ ${comparisonContext.originalInputs.interestRate}%` : ''
          },
          { 
            label: 'Alternative scenario', 
            value: 'affordability_scenario',
            description: comparisonContext ? `£${comparisonContext.scenarioInputs.price.toLocaleString()}, £${comparisonContext.scenarioInputs.deposit.toLocaleString()} deposit, ${comparisonContext.scenarioInputs.termYears} years @ ${comparisonContext.scenarioInputs.interestRate}%` : ''
          }
        ]
      })
      return
    }
    
    // Handle scenario selection for affordability
    if (ctaPrompt.type === 'scenario_selection_affordability') {
      if (comparisonContext) {
        const scenario = value === 'affordability_original' 
          ? comparisonContext.originalInputs 
          : comparisonContext.scenarioInputs
        
        const params = new URLSearchParams({
          price: scenario.price.toString(),
          deposit: scenario.deposit.toString(),
          term: scenario.termYears.toString(),
          rate: scenario.interestRate.toString(),
        })
        
        router.push(`/mortgage-affordability?${params.toString()}`)
      }
      return
    }
    
    const ctaMessage = `CTA_SELECTION:${ctaPrompt.type}:${value}`
    // If this is a deposit_amount_selection, attach lastInputs
    if (ctaPrompt.type === 'deposit_amount_selection' && lastInputs) {
      sendMessage(ctaMessage, lastInputs)
    } else {
      sendMessage(ctaMessage)
    }
  }

  return (
    <div className={styles.chatbot}>
      <h3 className={styles.chatbotTitle}>Mortgage Chatbot</h3>

      <div
        ref={chatLogRef}
        role="log"
        aria-label="Mortgage conversation"
        aria-live="polite"
        aria-busy={loading}
        className={styles.chatLog}
      >
        {messages
          .filter((msg) => !msg.content.startsWith('CTA_SELECTION:'))
          .map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.message} ${
                msg.role === 'user' ? styles.userMessage : ''
              }`}
            >
              <div className={styles.messageAvatar}>
                {msg.role === 'user' ? 'You' : 'A'}
              </div>
              <div className={styles.messageBubble}>
                {msg.content}
              </div>
            </div>
          ))}

        {/* Loading indicator */}
        {loading && (
          <div className={styles.loadingIndicator} role="status" aria-label="Assistant is thinking">
            <div className={styles.loadingDots}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className={styles.loadingText}>Assistant is thinking...</p>
          </div>
        )}

        {/* Render CTA buttons */}
        {ctaPrompt && (
          <div className={styles.chatChoices}>
            <p>{ctaPrompt.question}</p>
            <div className={styles.chatChoiceOptions}>
              {ctaPrompt.options.map((opt) => (
                <button
                  key={opt.value}
                  disabled={loading}
                  className={`${styles.actionButton} ${
                    opt.value === 'explore_affordability' ? styles.primaryCta : ''
                  } ${
                    opt.value === 'try_another_scenario' ? styles.secondaryCta : ''
                  }`}
                  onClick={() => handleCtaSelection(opt.value)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 500 }}>{opt.label}</div>
                    {opt.description && (
                      <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '4px' }}>
                        {opt.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className={styles.errorAlert}>
          <p className={styles.errorMessage}>{error}</p>
          {retryCount > 0 && (
            <p className={styles.errorRetryStatus}>
              Retry attempt {retryCount} of 3...
            </p>
          )}
          {errorType === 'permanent' && failedMessages && (
            <button
              type="button"
              onClick={() => {
                setRetryCount(0)
                submitMessages(failedMessages, 0)
              }}
              disabled={loading}
              className={styles.errorRetryButton}
              aria-label="Retry the failed message"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      <div className={styles.inputContainer}>
        <input
          ref={messageInputRef}
          aria-label="Message"
          disabled={loading}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputStage === 'price' || inputStage === 'deposit' || inputStage === 'term' || inputStage === 'rate' ? `Enter ${inputStage}...` : (inputStage === 'comparison_prompt' || inputStage === 'comparison_results') ? "Compare witha different scenario..." : "Ask about mortgages..."}
          className={styles.messageInput}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />

        <button
          ref={sendButtonRef}
          onClick={() => sendMessage()}
          disabled={loading}
          className={styles.actionButton}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
        
        {(inputStage === 'deposit' || inputStage === 'term' || inputStage === 'rate') && (
          <button
            onClick={() => {
              setCtaPrompt({
                question: '',
                type: 'edit_inputs',
                options: [
                  { label: 'Start over with new numbers', value: 'restart' },
                  { label: 'Change the property price', value: 'change_price' },
                  { label: 'Change the deposit', value: 'change_deposit' },
                  { label: 'Change the mortgage term', value: 'change_term' },
                  { label: 'Change the interest rate', value: 'change_rate' }
                ]
              })
            }}
            disabled={loading}
            className={styles.actionButton}
            style={{ background: '#f0f1f5', color: '#555', border: '1px solid #ddd' }}
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  )
}

export default Chatbot
