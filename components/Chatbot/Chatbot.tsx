import { useRef, useState, useEffect } from 'react'
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
}

interface CtaPromptOption {
  label: string
  value: string
}

interface CtaPrompt {
  question: string
  type: string
  options: CtaPromptOption[]
}

const Chatbot = ({ setChatbotResults, setComparison }: ChatbotProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ctaPrompt, setCtaPrompt] = useState<CtaPrompt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failedMessages, setFailedMessages] = useState<ChatMessage[] | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [errorType, setErrorType] = useState<'transient' | 'permanent' | null>(null)
  const [showComparisonHint, setShowComparisonHint] = useState(false)
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
        setComparison(data.comparison)
        setComparisonContext({
          originalInputs: data.comparison.originalInputs,
          scenarioInputs: data.comparison.scenarioInputs,
        })
      }

      if (data.ctaPrompt) {
        setCtaPrompt(data.ctaPrompt)
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

    const currentInputs = extra || comparisonContext?.originalInputs || lastInputs
    const messageObj: ChatMessage = currentInputs
      ? {
          role: 'user',
          content: messageToSend,
          originalInputs: currentInputs,
          ...(comparisonContext && { scenarioInputs: comparisonContext.scenarioInputs }),
        }
      : { role: 'user', content: messageToSend }

    setInput('')
    await submitMessages([...messages, messageObj])
  }

  const handleCtaSelection = (value: string) => {
    if (!value || !ctaPrompt) return
    
    // If they want to compare scenarios, focus input and set helpful placeholder
    if (ctaPrompt.type === 'scenario_comparison' && value === 'compare_scenarios') {
      setInput('')
      setShowComparisonHint(true)
      // Focus the input field and let them type their comparison question
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 100)
      // Clear the CTA prompt so they see the input field
      setCtaPrompt(null)
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
                  className={styles.actionButton}
                  onClick={() => handleCtaSelection(opt.value)}
                >
                  {opt.label}
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

      <input
        ref={messageInputRef}
        aria-label="Message"
        disabled={loading}
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          if (e.target.value) setShowComparisonHint(false)
        }}
        placeholder={showComparisonHint 
          ? "e.g., Compare 25 vs 30 year, or Try 5% interest rate, or What if I saved £10k more?"
          : "Ask about mortgages..."}
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
    </div>
  )
}

export default Chatbot
