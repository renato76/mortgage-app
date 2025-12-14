import { useState } from 'react'

interface ChatMessage {
  role: string
  content: string
}

export interface ChatbotMortgageResults {
  monthlyPayment: number
  totalCost: number
  capitalPaid: number
  interestPaid: number
}

interface ChatbotProps {
  setChatbotResults: (results: ChatbotMortgageResults) => void
}

const Chatbot = ({ setChatbotResults }: ChatbotProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return

    console.log('Sending message:', input)
    setLoading(true)

    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)

    try {
      console.log('Calling API with messages:', newMessages)

      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const responseText = await res.text()
      console.log('Raw response:', responseText)

      const data = JSON.parse(responseText)
      console.log('Parsed JSON:', data)

      console.log('Mortgage Results from API:', data.mortgageResults)

      // Store chatbot results when they exist
      if (data.mortgageResults) {
        setChatbotResults(data.mortgageResults)
      }

      if (data.reply && data.reply.tool_calls) {
        console.log('AI wants to use tools:', data.reply.tool_calls)
        setMessages([
          ...newMessages,
          { role: 'assistant', content: 'I need some mortgage info...' },
        ])
      } else if (data.reply && data.reply.content) {
        console.log('Normal AI response:', data.reply.content)
        setMessages([
          ...newMessages,
          { role: 'assistant', content: data.reply.content },
        ])
      } else {
        console.log('Unexpected response structure:', data)
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: 'Sorry, I got an unexpected response.',
          },
        ])
      }
    } catch (error) {
      console.error('Error calling chatbot:', error)
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, there was an error.' },
      ])
    }

    setInput('')
    setLoading(false)
  }

  return (
    <div className="mt-8 p-4 border rounded bg-white">
      <h3 className="font-bold mb-2">Mortgage Chatbot</h3>
      <div className="h-32 overflow-y-auto border p-2 mb-2 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-1 ${
              msg.role === 'user' ? 'text-blue-600' : 'text-green-600'
            }`}
          >
            <strong>{msg.role === 'user' ? 'You' : 'Bot'}:</strong>{' '}
            {msg.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about mortgages..."
        className="w-full p-2 border rounded mb-2"
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button
        onClick={sendMessage}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}

export default Chatbot
