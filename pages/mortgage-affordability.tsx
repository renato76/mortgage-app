import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const money = (value: number) => currency.format(value)

interface MortgageInputs {
  price: number
  deposit: number
  termYears: number
  interestRate: number
}

const calculateMonthlyPayment = (inputs: MortgageInputs): number => {
  if (inputs.price <= 0 || inputs.deposit <= 0) return 0
  const principal = inputs.price - inputs.deposit
  const monthlyRate = inputs.interestRate / 100 / 12
  const numPayments = inputs.termYears * 12
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
}

type Step = 'mortgage_summary' | 'household_income' | 'results'

const MortgageAffordability = () => {
  const router = useRouter()
  const { price, deposit, term, rate } = router.query
  const [step, setStep] = useState<Step>('mortgage_summary')
  const [householdIncome, setHouseholdIncome] = useState<number>(0)
  const [expenses, setExpenses] = useState({
    rent: 0,
    childcare: 0,
    debts: 0,
    other: 0,
  })

  const totalMonthlyExpenses = expenses.rent + expenses.childcare + expenses.debts + expenses.other
  const disposableIncome = householdIncome - totalMonthlyExpenses

  const scenario: MortgageInputs = {
    price: price ? Number(price) : 0,
    deposit: deposit ? Number(deposit) : 0,
    termYears: term ? Number(term) : 0,
    interestRate: rate ? Number(rate) : 0,
  }

  const monthlyPayment = calculateMonthlyPayment(scenario)

  const isCurrentStep = (stepName: Step) => step === stepName
  const isCompletedStep = (stepName: Step) => {
    const steps: Step[] = ['mortgage_summary', 'household_income', 'results']
    return steps.indexOf(stepName) < steps.indexOf(step)
  }

  const monthlyAffordable = disposableIncome
  const remainingAfterMortgage = disposableIncome - monthlyPayment
  const affordabilityRatio = disposableIncome > 0 ? (monthlyPayment / disposableIncome) * 100 : 0
  const isAffordable = affordabilityRatio <= 40

  // Calculate maximum house price they can afford
  const maxMonthlyPayment = disposableIncome * 0.40
  const maxLoanAmount = maxMonthlyPayment > 0 ? (() => {
    const monthlyRate = scenario.interestRate / 100 / 12
    const numPayments = scenario.termYears * 12
    if (monthlyRate === 0) return maxMonthlyPayment * numPayments
    return (maxMonthlyPayment * (Math.pow(1 + monthlyRate, numPayments) - 1)) / (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
  })() : 0
  const maxPropertyPrice = maxLoanAmount + scenario.deposit

  return (
    <>
      <Head><title>Mortgage Affordability</title></Head>
      <div className="min-h-screen flex flex-col bg-page-bg">
        <header className="border-b border-light">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-navy" />
              <span className="font-semibold text-navy">Mortgage Assistant</span>
            </div>
            <Link 
              href="/mortgage-assistant" 
              className="text-sm font-medium hover:opacity-80 transition text-navy"
            >
              Back to assistant →
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-6 py-12">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-wide mb-2 text-gray-500">AFFORDABILITY CHECK</p>
              <h1 className="text-3xl md:text-4xl font-bold text-navy">Can you afford this mortgage?</h1>
            </div>

            {/* Stepper */}
            <div className="mb-12">
              <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm">
                <button 
                  onClick={() => setStep('mortgage_summary')}
                  className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-white transition cursor-pointer hover:opacity-80 ${
                    isCurrentStep('mortgage_summary') ? 'bg-navy' : isCompletedStep('mortgage_summary') ? 'bg-teal' : 'bg-teal-light'
                  }`}
                >
                  {isCompletedStep('mortgage_summary') ? '✓' : '1'}
                </button>
                <span className="hidden md:inline text-gray-500">Mortgage details</span>
                
                <div 
                  className={`flex-1 h-0.5 transition ${isCurrentStep('mortgage_summary') ? 'bg-teal-light' : 'bg-teal'}`}
                />
                
                <button 
                  onClick={() => setStep('household_income')}
                  className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-white transition cursor-pointer hover:opacity-80 ${
                    isCurrentStep('household_income') ? 'bg-navy' : isCompletedStep('household_income') ? 'bg-teal' : 'bg-teal-light'
                  }`}
                >
                  {isCompletedStep('household_income') ? '✓' : '2'}
                </button>
                <span className="hidden md:inline text-gray-500">Finances</span>
                
                <div 
                  className={`flex-1 h-0.5 transition ${isCurrentStep('results') || isCompletedStep('results') ? 'bg-teal' : 'bg-teal-light'}`}
                />
                
                <button 
                  onClick={() => setStep('results')}
                  className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-white transition cursor-pointer hover:opacity-80 ${
                    isCurrentStep('results') ? 'bg-navy' : isCompletedStep('results') ? 'bg-teal' : 'bg-teal-light'
                  }`}
                >
                  3
                </button>
                <span className="hidden md:inline text-gray-500">Results</span>
              </div>
            </div>

            {/* Step 1: Mortgage Summary */}
            {step === 'mortgage_summary' && (
              <div className="space-y-6">
                <div 
                  className="rounded-lg p-6 md:p-8 border bg-white border-light"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Property price</span>
                      <strong className="text-navy">{money(scenario.price)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Deposit</span>
                      <strong className="text-navy">£{scenario.deposit.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Mortgage term</span>
                      <strong className="text-navy">{scenario.termYears} years</strong>
                    </div>
                    <div 
                      className="pt-4 flex justify-between items-center border-t border-mint-border"
                    >
                      <span className="text-sm text-gray-500">Interest rate</span>
                      <strong className="text-navy">{scenario.interestRate}%</strong>
                    </div>
                  </div>
                </div>

                <div 
                  className="rounded-lg p-6 md:p-8 border bg-white border-light"
                >
                  <p className="text-sm mb-2 text-gray-500">Estimated monthly repayment</p>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-3xl md:text-4xl text-navy">{money(monthlyPayment)}</strong>
                    <span className="text-gray-500">/month</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => router.push('/mortgage-assistant')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium transition bg-gray-300 text-navy hover:opacity-80"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('household_income')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium text-white bg-navy hover:opacity-90 transition"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Household Income & Expenses */}
            {step === 'household_income' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-semibold mb-2 text-navy">Your financial situation</h3>
                  <p className="text-sm text-gray-500">Help us understand your income and existing commitments</p>
                </div>

                <div 
                  className="rounded-lg p-6 md:p-8 border bg-white border-light"
                >
                  <label className="block text-sm font-medium mb-2 text-navy">
                    What is your total household income (after tax) per month?
                  </label>
                  <p className="text-xs mb-4 text-gray-500">Monthly income that&apos;s available to spend after tax and national insurance</p>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">£</span>
                    <input
                      type="number"
                      value={householdIncome || ''}
                      onChange={(e) => setHouseholdIncome(Number(e.target.value))}
                      placeholder="Monthly income"
                      className="flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none transition border border-light text-navy"
                      onFocus={(e) => {
                        e.target.style.outline = 'none'
                        e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                      }}
                      onBlur={(e) => {
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4 text-navy">Do you have existing monthly costs?</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg p-4 border bg-white border-light">
                      <label className="text-sm font-medium text-navy">Rent or housing costs</label>
                      <p className="text-xs mt-1 mb-2 text-gray-500">Current rent, mortgage, or housing payments you&apos;re committed to</p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">£</span>
                        <input
                          type="number"
                          value={expenses.rent || ''}
                          onChange={(e) => setExpenses({ ...expenses, rent: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition border border-light text-navy"
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm text-gray-500">/month</span>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 border bg-white border-light">
                      <label className="text-sm font-medium text-navy">Childcare costs</label>
                      <p className="text-xs mt-1 mb-2 text-gray-500">Nursery, nanny, or school fees you&apos;re currently paying</p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">£</span>
                        <input
                          type="number"
                          value={expenses.childcare || ''}
                          onChange={(e) => setExpenses({ ...expenses, childcare: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition border border-light text-navy"
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm text-gray-500">/month</span>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 border bg-white border-light">
                      <label className="text-sm font-medium text-navy">Existing debts or loans</label>
                      <p className="text-xs mt-1 mb-2 text-gray-500">Car loans, credit cards, student loans, or other monthly debt payments</p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">£</span>
                        <input
                          type="number"
                          value={expenses.debts || ''}
                          onChange={(e) => setExpenses({ ...expenses, debts: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition border border-light text-navy"
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm text-gray-500">/month</span>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 border bg-white border-light">
                      <label className="text-sm font-medium text-navy">Other monthly commitments</label>
                      <p className="text-xs mt-1 mb-2 text-gray-500">
                        <strong>Include:</strong> Subscriptions, gym memberships, insurance premiums, regular support payments<br/>
                        <strong>Don&apos;t include:</strong> Groceries, utilities, or one-off expenses
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">£</span>
                        <input
                          type="number"
                          value={expenses.other || ''}
                          onChange={(e) => setExpenses({ ...expenses, other: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition border border-light text-navy"
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm text-gray-500">/month</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg p-6 mb-2 bg-mint">
                  <p className="text-sm font-medium mb-1 text-navy">Your disposable income</p>
                  <p className={`text-2xl font-bold ${disposableIncome > 0 ? 'text-teal' : 'text-red-error'}`}>
                    {money(Math.max(0, disposableIncome))} per month
                  </p>
                  <p className="text-xs mt-2 text-gray-500">
                    {money(householdIncome)} - {money(totalMonthlyExpenses)} = {money(Math.max(0, disposableIncome))}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('mortgage_summary')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium transition bg-gray-300 text-navy hover:opacity-80"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('results')}
                    disabled={householdIncome <= 0}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition bg-navy"
                  >
                    Check Affordability
                  </button>
                </div>
              </div>
            )}

            {/* Results Page */}
            {step === 'results' && (
              <div className="space-y-8">
                <div className="text-center">
                  <p className="text-xs font-semibold tracking-wide mb-4 text-gray-500">YOUR RESULTS</p>
                  <h1 className="text-3xl md:text-4xl font-bold mb-2 text-navy">
                    You could buy a home worth up to
                  </h1>
                  <div className="text-5xl md:text-6xl font-bold my-6 text-navy">
                    {money(maxPropertyPrice)}
                  </div>
                  <p className="text-lg mb-4 text-gray-500">
                    vs {money(scenario.price)} for this property
                  </p>
                  <p className={`text-sm ${isAffordable ? 'text-teal' : 'text-red-error'}`}>
                    {isAffordable ? '✓ You can afford this mortgage' : '✗ This mortgage may be stretching'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg p-6 border bg-white border-light">
                    <p className="text-xs font-semibold mb-2 text-gray-500">Monthly Payment</p>
                    <p className="text-2xl md:text-3xl font-bold text-navy">{money(monthlyPayment)}</p>
                  </div>
                  <div className="rounded-lg p-6 border bg-white border-light">
                    <p className="text-xs font-semibold mb-2 text-gray-500">Disposable Income</p>
                    <p className="text-2xl md:text-3xl font-bold text-navy">{money(monthlyAffordable)}</p>
                  </div>
                  <div className="rounded-lg p-6 border bg-white border-light">
                    <p className="text-xs font-semibold mb-2 text-gray-500">Remaining Monthly</p>
                    <p className={`text-2xl md:text-3xl font-bold ${remainingAfterMortgage > 0 ? 'text-teal' : 'text-red-error'}`}>{money(remainingAfterMortgage)}</p>
                  </div>
                </div>

                <div className="rounded-lg p-6 border bg-white border-light">
                  <h3 className="font-semibold mb-4 text-navy">Affordability Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Monthly mortgage payment</span>
                      <strong className="text-navy">{money(monthlyPayment)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">As % of monthly income</span>
                      <strong className="text-navy">{affordabilityRatio.toFixed(1)}%</strong>
                    </div>
                    <div className="pt-3 border-t border-light">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Remaining monthly income</span>
                        <strong className={remainingAfterMortgage > 0 ? 'text-teal' : 'text-red-error'}>{money(remainingAfterMortgage)}</strong>
                      </div>
                    </div>
                  </div>
                  {affordabilityRatio <= 30 && (
                    <div className="mt-4 p-3 rounded bg-mint">
                      <p className="text-sm font-medium text-teal">✓ Excellent affordability (under 30% of income)</p>
                      <p className="text-xs mt-2 text-gray-500">Your remaining income comfortably covers living expenses, savings, and emergencies.</p>
                    </div>
                  )}
                  {affordabilityRatio > 30 && affordabilityRatio <= 40 && (
                    <div className="mt-4 p-3 rounded bg-mint">
                      <p className="text-sm font-medium text-teal">✓ Good affordability (30-40% of income)</p>
                      <p className="text-xs mt-2 text-gray-500">Your remaining income covers living expenses and allows for some savings and unexpected costs.</p>
                    </div>
                  )}
                  {affordabilityRatio > 40 && (
                    <div className="mt-4 p-3 rounded bg-red-light">
                      <p className="text-sm font-medium text-red-error">⚠ Tight affordability (over 40% of income)</p>
                      <p className="text-xs mt-2 text-gray-500">Your remaining income must cover groceries, utilities, transport, insurance, and other living costs. You&apos;ll have limited flexibility for savings or emergencies. Consider adjusting your budget or looking at more affordable properties.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('household_income')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium transition bg-gray-300 text-navy hover:opacity-80"
                  >
                    Edit my details
                  </button>
                  <button
                    onClick={() => router.push('/mortgage-assistant')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium text-white bg-navy hover:opacity-90 transition"
                  >
                    Back to assistant
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}

export default MortgageAffordability
