import { useState } from 'react'

interface MortgageInputs {
  price: number
  deposit: number
  interestRate: number
  termYears: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  originalInputs?: MortgageInputs
}

export interface ChatbotMortgageResults {
  monthlyPayment: number
  totalCost: number
  capitalPaid: number
  interestPaid: number
  remainingBalance?: number
}

export interface MortgageComparison {
  originalPrice: number
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
  setChatbotResults: (results: ChatbotMortgageResults) => void
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

  // Store last known mortgage inputs
  const [lastInputs, setLastInputs] = useState<MortgageInputs | null>(null)

  const sendMessage = async (userInput?: string, extra?: MortgageInputs) => {
    const messageToSend = userInput ?? input
    if (!messageToSend.trim()) return

    const messageObj: ChatMessage = extra
      ? { role: 'user', content: messageToSend, originalInputs: extra }
      : { role: 'user', content: messageToSend }

    const newMessages: ChatMessage[] = [...messages, messageObj]

    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setCtaPrompt(null) // clear previous CTA

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()

      if (data.message) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: data.message },
        ])
      }
      if (data.mortgageResults && data.state === 'complete') {
        setChatbotResults(data.mortgageResults)
        setLastInputs(data.originalInputs || null)
      }

      if (data.comparison) {
        setComparison(data.comparison)
      }

      if (data.ctaPrompt) {
        setCtaPrompt(data.ctaPrompt)
      }
    } catch (error) {
      console.error('Error calling chatbot:', error)
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, there was an error.' },
      ])
    } finally {
      setLoading(false)
    }
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
    <div className="mt-8 p-4 border rounded bg-white text-gray-900">
      <h3 className="font-bold mb-2">Mortgage Chatbot</h3>

      <div className="h-96 overflow-y-auto border p-2 mb-2 bg-gray-50">
        {messages
          .filter((msg) => !msg.content.startsWith('CTA_SELECTION:'))
          .map((msg, idx) => (
            <div
              key={idx}
              className={`mb-1 ${
                msg.role === 'user' ? 'text-blue-600' : 'text-green-700'
              }`}
            >
              <strong>{msg.role === 'user' ? 'You' : 'Bot'}:</strong>{' '}
              {msg.content}
            </div>
          ))}

        {/* Render CTA buttons */}
        {ctaPrompt && (
          <div className="mt-2 p-2 border rounded bg-gray-100">
            <p className="mb-2 font-semibold">{ctaPrompt.question}</p>
            <div className="flex gap-2 flex-wrap">
              {ctaPrompt.options.map((opt) => (
                <button
                  key={opt.value}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                  onClick={() => handleCtaSelection(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about mortgages..."
        className="w-full p-2 border rounded mb-2 bg-white"
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />

      <button
        onClick={() => sendMessage()}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}

export default Chatbot
