import MortgageResults from '@/components/MortgageResults/MortgageResults'
import Chatbot, { ChatbotMortgageResults } from '@/components/Chatbot/Chatbot'
import { calculateRemainingBalance } from '@/utils/calculateRemainingBalance'
import { GetServerSideProps } from 'next'
import { RadioGroup } from '@headlessui/react'
import { useState } from 'react'

// Define the props expected by the component
interface MortgageProps {
  monthlyPayment?: number
  totalCost?: number
  capitalPaid?: number
  interestPaid?: number
  remainingBalance?: Array<{ year: number; balance: number }>
  price?: string
  deposit?: string
  interestRate?: string
  termYears?: string
}

// Here is the main client component
const MortgageCalculator = ({
  monthlyPayment,
  totalCost,
  capitalPaid,
  interestPaid,
  remainingBalance,
  price,
  deposit,
  interestRate,
  termYears,
}: MortgageProps) => {
  console.log({ remainingBalance })

  const [chatbotResults, setChatbotResults] =
    useState<ChatbotMortgageResults | null>(null)

  const mortgageTypes = [
    { name: 'Remortgage', available: true },
    { name: 'Interest Only', available: true },
  ]
  const [selected, setSelected] = useState(mortgageTypes[0].name)

  return (
    <div className="mx-auto bg-[#e8e8e8] min-h-screen pb-24">
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-center mb-12 pt-8 text-white bg-blue-600 pb-8">
        Mortgage Calculator
      </h1>

      <div className="px-4 max-w-md sm:max-w-lg mx-auto md:max-w-3xl lg:max-w-4xl">
        <div className="flex flex-col md:flex-row w-full  bg-[#f1f1f1] pt-12 rounded-[20px]">
          <div className="w-full md:w-1/2 md:mr-6 pb-48 px-4">
            <form
              action="/mortgage-calculator"
              method="get"
              className="space-y-4"
            >
              <div className="py-2">
                <div className="flex flex-col justify-start space-y-6">
                  <RadioGroup value={selected} onChange={setSelected}>
                    <RadioGroup.Label className="block font-bold text-gray-900 text-lg lg:text-2xl ml-1 mb-4">
                      Type of mortgage
                    </RadioGroup.Label>
                    <div className="flex flex-col space-y-4">
                      {mortgageTypes.map((mortgageType) => (
                        <RadioGroup.Option
                          key={mortgageType.name}
                          value={mortgageType.name}
                          disabled={!mortgageType.available}
                          className={({ checked, disabled }) =>
                            [
                              'flex items-center gap-2 cursor-pointer rounded px-2 py-2',
                              checked
                                ? 'border-2 border-blue-600 bg-blue-50'
                                : 'border border-gray-300',
                              disabled ? 'opacity-50 cursor-not-allowed' : '',
                            ].join(' ')
                          }
                        >
                          {({ checked }) => (
                            <>
                              <span
                                className={[
                                  'inline-block w-5 h-5 rounded-full border flex items-center justify-center',
                                  checked
                                    ? 'border-blue-600'
                                    : 'border-gray-400',
                                  'mr-2',
                                ].join(' ')}
                              >
                                {checked && (
                                  <span className="w-3 h-3 bg-blue-600 rounded-full" />
                                )}
                              </span>
                              <span className="font-bold text-gray-900 text-lg">
                                {mortgageType.name}
                              </span>
                            </>
                          )}
                        </RadioGroup.Option>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <div className="py-2">
                <label
                  htmlFor="price"
                  className="block font-bold text-gray-900 text-lg lg:text-2xl ml-1 mb-2"
                >
                  Property Price
                </label>
                <p className="ml-1 mb-2 text-gray-700">
                  Enter the property price or the re-mortgage amount.
                </p>
                <div className="flex items-stretch">
                  <span className="bg-gray-200 px-3 py-3  text-gray-600 text-lg flex items-center rounded-l-[10px]">
                    £
                  </span>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    required
                    defaultValue={price}
                    className="p-3 border border-gray-300 w-full no-spinner rounded-r-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="Property Price"
                  />
                </div>
              </div>
              <span className="block border-b border-gray-400" />
              <div className="py-2">
                <label
                  htmlFor="deposit"
                  className="block font-bold text-gray-800 text-lg lg:text-2xl ml-1 mb-2"
                >
                  Deposit
                </label>
                <p className="ml-1 mb-2 text-gray-700">
                  If you&apos;re remortgaging, this does not apply.
                </p>
                <div className="flex items-stretch">
                  <span className="bg-gray-200 px-3 py-3  text-gray-600 text-lg flex items-center rounded-l-[10px]">
                    £
                  </span>
                  <input
                    type="number"
                    id="deposit"
                    name="deposit"
                    required
                    defaultValue={deposit}
                    className="p-3 border border-gray-300 w-full no-spinner rounded-r-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="Deposit"
                  />
                </div>
              </div>
              <span className="block border-b border-gray-400" />
              <div className="py-2">
                <label
                  htmlFor="interestRate"
                  className="block font-bold text-gray-800 text-lg lg:text-2xl ml-1"
                >
                  Interest Rate
                </label>
                <p className="ml-1 mb-2 text-gray-700">
                  We&apos;ve defaulted to the current interest rate.
                </p>
                <div className="flex items-stretch">
                  <input
                    type="number"
                    id="interestRate"
                    name="interestRate"
                    required
                    step="0.01"
                    defaultValue={interestRate}
                    className="p-3 border z-10  border-gray-300 w-full no-spinner rounded-l-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="Interest Rate"
                  />
                  <span className="bg-gray-200 px-3 py-3 z-0  text-gray-600 text-lg flex items-center rounded-r-[10px]">
                    %
                  </span>
                </div>
              </div>
              <span className="block border-b border-gray-400" />
              <div className="py-2">
                <label
                  htmlFor="termYears"
                  className="block font-bold text-gray-800 text-lg lg:text-2xl ml-1"
                >
                  Mortgage Term
                </label>
                <p className="ml-1 mb-2 text-gray-700">
                  The average period for repayment of a mortgage is 25 years.
                </p>
                <div className="relative">
                  <select
                    id="termYears"
                    name="termYears"
                    required
                    defaultValue={termYears}
                    className="mt-1 mb-8 p-4 border border-gray-300 rounded-[10px] w-full bg-white appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="Mortgage Term"
                  >
                    <option value="" disabled>
                      Select term
                    </option>
                    {[...Array(36)].map((_, i) => {
                      const year = i + 5
                      return (
                        <option key={year} value={year}>
                          {year} years
                        </option>
                      )
                    })}
                  </select>
                  <span className="bg-blue-600 pointer-events-none absolute right-0 top-1 h-[58px] aspect-square flex items-center justify-center rounded-r-[10px] text-white text-xl">
                    ▼
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="w-full  bg-blue-600 text-white py-3 rounded-[10px] font-semibold hover:bg-blue-700 transition"
              >
                Calculate
              </button>
            </form>

            {/* Pass setChatbotResults to the chatbot */}
            <Chatbot setChatbotResults={setChatbotResults} />
          </div>

          {/* Display the calculation results from EITHER form OR chatbot */}
          <div className="w-full md:w-1/2 px-4">
            {(monthlyPayment || chatbotResults) && (
              <MortgageResults
                monthlyPayment={
                  chatbotResults?.monthlyPayment || monthlyPayment
                }
                totalCost={chatbotResults?.totalCost || totalCost}
                capitalPaid={chatbotResults?.capitalPaid || capitalPaid}
                interestPaid={chatbotResults?.interestPaid || interestPaid}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Server-side calculation using getServerSideProps
export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const { price, deposit, interestRate, termYears } = query

  if (
    !price ||
    !deposit ||
    !interestRate ||
    !termYears ||
    isNaN(Number(price)) ||
    isNaN(Number(deposit)) ||
    isNaN(Number(interestRate)) ||
    isNaN(Number(termYears))
  ) {
    return { props: {} }
  }

  const loanAmount = Number(price) - Number(deposit)
  const rate = Number(interestRate) / 100 / 12
  const numberOfMonths = Number(termYears) * 12

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
    props: {
      monthlyPayment,
      totalCost,
      capitalPaid,
      interestPaid,
      remainingBalance,
      price: price || '',
      deposit: deposit || '',
      interestRate: interestRate || '',
      termYears: termYears || '',
    },
  }
}

export default MortgageCalculator
