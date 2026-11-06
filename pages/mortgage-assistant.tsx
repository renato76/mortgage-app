import { useState } from 'react'
import Chatbot, {
  ChatbotMortgageResults,
  MortgageComparison,
} from '@/components/Chatbot/Chatbot'
import MortgageResults from '@/components/MortgageResults/MortgageResults'

const MortgageAssistant = () => {
  const [chatbotResults, setChatbotResults] =
    useState<ChatbotMortgageResults | null>(null)
  const [comparison, setComparison] = useState<MortgageComparison | null>(null)

  return (
    <div className="mx-auto bg-[#e8e8e8] min-h-screen pb-24">
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-center mb-12 pt-8 text-[#00c99a] bg-[#0d003d] pb-8">
        Mortgage Assistant
      </h1>

      <div className="w-full px-0 lg:px-4 mx-auto md:max-w-4xl lg:max-w-5xl">
        <div className="flex flex-col lg:flex-row w-full bg-[#f1f1f1] pt-12 rounded-[20px]">
          {/* Chatbot Section - Full width on mobile, half on desktop */}
          <div className="w-full lg:w-1/2 lg:mr-6 pb-12 px-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Chat with your Mortgage Assistant
            </h2>
            <p className="text-gray-700 mb-6">
              Start chatting to calculate your mortgage. I’ll ask for the
              property price, deposit, interest rate, and term.
            </p>
            <Chatbot
              setChatbotResults={setChatbotResults}
              setComparison={setComparison}
            />
          </div>

          {/* Results Section - Shows both original and scenario results for comparison */}
          <div className="w-full lg:w-1/2 px-4 pb-12">
            {comparison ? (
              <div className="border rounded p-4 bg-white">
                <h3 className="font-bold text-lg mb-4">Deposit Comparison</h3>

                {/* Property Price */}
                <p className="mb-4 font-semibold">
                  Property price: £{comparison.originalPrice.toLocaleString()}
                </p>

                {/* Comparison Table */}
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b px-2 py-1"></th>
                      <th className="border-b px-2 py-1">Current Deposit</th>
                      <th className="border-b px-2 py-1">
                        With Increased Deposit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 font-semibold">
                        Monthly Payment
                      </td>
                      <td className="px-2 py-1">
                        £{comparison.original.results.monthlyPayment.toFixed(2)}
                      </td>
                      <td className="px-2 py-1">
                        £{comparison.scenario.results.monthlyPayment.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-semibold">Capital Paid</td>
                      <td className="px-2 py-1">
                        £
                        {comparison.original.results.capitalPaid.toLocaleString()}
                      </td>
                      <td className="px-2 py-1">
                        £
                        {comparison.scenario.results.capitalPaid.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-semibold">Interest Paid</td>
                      <td className="px-2 py-1">
                        £
                        {comparison.original.results.interestPaid.toLocaleString()}
                      </td>
                      <td className="px-2 py-1">
                        £
                        {comparison.scenario.results.interestPaid.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-semibold">Total Cost</td>
                      <td className="px-2 py-1">
                        £
                        {comparison.original.results.totalCost.toLocaleString()}
                      </td>
                      <td className="px-2 py-1">
                        £
                        {comparison.scenario.results.totalCost.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-gray-100">
                      <td className="px-2 py-1 font-semibold">You Save</td>
                      <td className="px-2 py-1">-</td>
                      <td className="px-2 py-1">
                        £{comparison.delta.totalInterest.toLocaleString()}{' '}
                        interest, over the course of the mortgage
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : chatbotResults ? (
              // Show original result if no comparison yet
              <MortgageResults
                monthlyPayment={chatbotResults.monthlyPayment}
                totalCost={chatbotResults.totalCost}
                capitalPaid={chatbotResults.capitalPaid}
                interestPaid={chatbotResults.interestPaid}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MortgageAssistant
