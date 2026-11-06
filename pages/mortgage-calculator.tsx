import MortgageResults from '@/components/MortgageResults/MortgageResults'
import {
  calculateMortgageDetails,
  MortgageValidationError,
} from '@/utils/calculateMortgageDetails'
import { GetServerSideProps } from 'next'

interface MortgageProps {
  error?: string
  fundingType?: 'mortgage' | 'cash'
  purchasePrice?: number
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

const MortgageCalculator = ({
  error,
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

  return (
    <div className="mx-auto bg-[#e8e8e8] min-h-screen pb-24">
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-center mb-12 pt-8 text-white bg-blue-600 pb-8">
        Mortgage Calculator
      </h1>

      <div className="px-4 max-w-md sm:max-w-lg mx-auto md:max-w-3xl lg:max-w-4xl">
        <div className="flex flex-col md:flex-row w-full  bg-[#f1f1f1] pt-12 rounded-[20px]">
          <div className="w-full md:w-1/2 md:mr-6 pb-48 px-4">
            {error && (
              <p role="alert" className="mb-4 p-3 border border-red-300 bg-red-50 text-red-800 rounded">
                {error}
              </p>
            )}
            <form
              action="/mortgage-calculator"
              method="get"
              className="space-y-4"
            >
              <div className="py-2">
                <label
                  htmlFor="price"
                  className="block font-bold text-gray-900 text-lg lg:text-2xl ml-1 mb-2"
                >
                  Property Price
                </label>
                <p className="ml-1 mb-2 text-gray-700">
                  Enter the purchase price of the property.
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
                  The amount of the property price you will pay upfront.
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
          </div>

          {/* Display the calculation results from form submission */}
          <div className="w-full md:w-1/2 px-4">
            {monthlyPayment && (
              <MortgageResults
                monthlyPayment={monthlyPayment}
                totalCost={totalCost}
                capitalPaid={capitalPaid}
                interestPaid={interestPaid}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<MortgageProps> = async ({ query }) => {
  const fields = ['price', 'deposit', 'interestRate', 'termYears'] as const

  if (fields.every((field) => query[field] === undefined)) {
    return { props: {} }
  }

  const inputs = {
    price: typeof query.price === 'string' ? query.price : '',
    deposit: typeof query.deposit === 'string' ? query.deposit : '',
    interestRate: typeof query.interestRate === 'string' ? query.interestRate : '',
    termYears: typeof query.termYears === 'string' ? query.termYears : '',
  }

  try {
    if (fields.some((field) => Array.isArray(query[field]))) {
      throw new MortgageValidationError('Enter one value for each mortgage input.')
    }

    const results = calculateMortgageDetails(
      inputs.price.trim() === '' ? NaN : Number(inputs.price),
      inputs.deposit.trim() === '' ? NaN : Number(inputs.deposit),
      inputs.interestRate.trim() === '' ? undefined : Number(inputs.interestRate),
      inputs.termYears.trim() === '' ? undefined : Number(inputs.termYears)
    )

    return { props: { ...inputs, ...results } }
  } catch (error) {
    if (!(error instanceof MortgageValidationError)) throw error
    return { props: { ...inputs, error: error.message } }
  }
}

export default MortgageCalculator
