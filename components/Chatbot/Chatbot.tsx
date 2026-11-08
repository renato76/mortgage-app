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
  const requestInFlight = useRef(false)
  const chatLogRef = useRef<HTMLDivElement>(null)

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

  const submitMessages = async (newMessages: ChatMessage[]) => {
    if (requestInFlight.current) return
    requestInFlight.current = true

    setMessages(newMessages)
    setLoading(true)
    setError(null)
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
    } catch (error) {
      setError(
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : 'Unable to reach the mortgage assistant. Check your connection and try again.'
      )
      setFailedMessages(newMessages)
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
              <strong>{msg.role === 'user' ? 'You' : 'Bot'}:</strong>{' '}
              {msg.content}
            </div>
          ))}

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
        <div role="alert" className="mb-3 p-3 border border-red-300 bg-red-50 text-red-800 rounded">
          <p>{error}</p>
          {failedMessages && (
            <button
              type="button"
              onClick={() => submitMessages(failedMessages)}
              disabled={loading}
              className="mt-2 px-3 py-1 border border-red-800 rounded font-semibold disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <input
        aria-label="Message"
        disabled={loading}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about mortgages..."
        className={styles.messageInput}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />

      <button
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
