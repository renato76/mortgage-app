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
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F6F8' }}>
        <header style={{ borderBottomColor: '#E8E9F0' }} className="border-b">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded" style={{ backgroundColor: '#100638' }} />
              <span className="font-semibold" style={{ color: '#100638' }}>Mortgage Assistant</span>
            </div>
            <Link 
              href="/mortgage-assistant" 
              className="text-sm font-medium hover:opacity-80 transition"
              style={{ color: '#100638' }}
            >
              Back to assistant →
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-6 py-12">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-wide mb-2" style={{ color: '#626477' }}>AFFORDABILITY CHECK</p>
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#100638' }}>Can you afford this mortgage?</h1>
            </div>

            {/* Stepper */}
            <div className="mb-12">
              <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm">
                <button 
                  onClick={() => setStep('mortgage_summary')}
                  className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-white transition cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: isCurrentStep('mortgage_summary') ? '#100638' : isCompletedStep('mortgage_summary') ? '#00BD98' : '#D1D1D8' }}
                >
                  {isCompletedStep('mortgage_summary') ? '✓' : '1'}
                </button>
                <span className="hidden md:inline" style={{ color: '#626477' }}>Mortgage details</span>
                
                <div 
                  className="flex-1 h-0.5 transition"
                  style={{ backgroundColor: isCurrentStep('mortgage_summary') ? '#D1D1D8' : '#00BD98' }}
                />
                
                <button 
                  onClick={() => setStep('household_income')}
                  className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-white transition cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: isCurrentStep('household_income') ? '#100638' : isCompletedStep('household_income') ? '#00BD98' : '#D1D1D8' }}
                >
                  {isCompletedStep('household_income') ? '✓' : '2'}
                </button>
                <span className="hidden md:inline" style={{ color: '#626477' }}>Finances</span>
                
                <div 
                  className="flex-1 h-0.5 transition"
                  style={{ backgroundColor: isCurrentStep('results') || isCompletedStep('results') ? '#00BD98' : '#D1D1D8' }}
                />
                
                <button 
                  onClick={() => setStep('results')}
                  className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-white transition cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: isCurrentStep('results') ? '#100638' : isCompletedStep('results') ? '#00BD98' : '#D1D1D8' }}
                >
                  3
                </button>
                <span className="hidden md:inline" style={{ color: '#626477' }}>Results</span>
              </div>
            </div>

            {/* Step 1: Mortgage Summary */}
            {step === 'mortgage_summary' && (
              <div className="space-y-6">
                <div 
                  className="rounded-lg p-6 md:p-8 border"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: '#626477' }}>Property price</span>
                      <strong style={{ color: '#100638' }}>{money(scenario.price)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: '#626477' }}>Deposit</span>
                      <strong style={{ color: '#100638' }}>£{scenario.deposit.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: '#626477' }}>Mortgage term</span>
                      <strong style={{ color: '#100638' }}>{scenario.termYears} years</strong>
                    </div>
                    <div 
                      className="pt-4 flex justify-between items-center"
                      style={{ borderTopColor: '#B8E6DD' }}
                    >
                      <span className="text-sm" style={{ color: '#626477' }}>Interest rate</span>
                      <strong style={{ color: '#100638' }}>{scenario.interestRate}%</strong>
                    </div>
                  </div>
                </div>

                <div 
                  className="rounded-lg p-6 md:p-8 border"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}
                >
                  <p className="text-sm mb-2" style={{ color: '#626477' }}>Estimated monthly repayment</p>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-3xl md:text-4xl" style={{ color: '#100638' }}>{money(monthlyPayment)}</strong>
                    <span style={{ color: '#626477' }}>/month</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => router.push('/mortgage-assistant')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium transition"
                    style={{ 
                      backgroundColor: '#E8E9F0',
                      color: '#100638'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('household_income')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium text-white hover:opacity-90 transition"
                    style={{ backgroundColor: '#100638' }}
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
                  <h3 className="text-lg md:text-xl font-semibold mb-2" style={{ color: '#100638' }}>Your financial situation</h3>
                  <p className="text-sm" style={{ color: '#626477' }}>Help us understand your income and existing commitments</p>
                </div>

                <div 
                  className="rounded-lg p-6 md:p-8 border"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}
                >
                  <label className="block text-sm font-medium mb-2" style={{ color: '#100638' }}>
                    What is your total household income (after tax) per month?
                  </label>
                  <p className="text-xs mb-4" style={{ color: '#626477' }}>Monthly income that's available to spend after tax and national insurance</p>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#626477' }}>£</span>
                    <input
                      type="number"
                      value={householdIncome || ''}
                      onChange={(e) => setHouseholdIncome(Number(e.target.value))}
                      placeholder="Monthly income"
                      className="flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                      style={{ 
                        borderColor: '#E8E9F0',
                        borderWidth: '1px',
                        color: '#100638'
                      }}
                      onFocus={(e) => {
                        e.target.style.outline = 'none'
                        e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                      }}
                      onBlur={(e) => {
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <span className="text-sm" style={{ color: '#626477' }}>/month</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4" style={{ color: '#100638' }}>Do you have existing monthly costs?</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                      <label className="text-sm font-medium" style={{ color: '#100638' }}>Rent or housing costs</label>
                      <p className="text-xs mt-1 mb-2" style={{ color: '#626477' }}>Current rent, mortgage, or housing payments you're committed to</p>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#626477' }}>£</span>
                        <input
                          type="number"
                          value={expenses.rent || ''}
                          onChange={(e) => setExpenses({ ...expenses, rent: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition"
                          style={{ 
                            borderColor: '#E8E9F0',
                            borderWidth: '1px',
                            color: '#100638'
                          }}
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm" style={{ color: '#626477' }}>/month</span>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                      <label className="text-sm font-medium" style={{ color: '#100638' }}>Childcare costs</label>
                      <p className="text-xs mt-1 mb-2" style={{ color: '#626477' }}>Nursery, nanny, or school fees you're currently paying</p>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#626477' }}>£</span>
                        <input
                          type="number"
                          value={expenses.childcare || ''}
                          onChange={(e) => setExpenses({ ...expenses, childcare: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition"
                          style={{ 
                            borderColor: '#E8E9F0',
                            borderWidth: '1px',
                            color: '#100638'
                          }}
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm" style={{ color: '#626477' }}>/month</span>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                      <label className="text-sm font-medium" style={{ color: '#100638' }}>Existing debts or loans</label>
                      <p className="text-xs mt-1 mb-2" style={{ color: '#626477' }}>Car loans, credit cards, student loans, or other monthly debt payments</p>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#626477' }}>£</span>
                        <input
                          type="number"
                          value={expenses.debts || ''}
                          onChange={(e) => setExpenses({ ...expenses, debts: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition"
                          style={{ 
                            borderColor: '#E8E9F0',
                            borderWidth: '1px',
                            color: '#100638'
                          }}
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm" style={{ color: '#626477' }}>/month</span>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                      <label className="text-sm font-medium" style={{ color: '#100638' }}>Other monthly commitments</label>
                      <p className="text-xs mt-1 mb-2" style={{ color: '#626477' }}>
                        <strong>Include:</strong> Subscriptions, gym memberships, insurance premiums, regular support payments<br/>
                        <strong>Don't include:</strong> Groceries, utilities, or one-off expenses
                      </p>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#626477' }}>£</span>
                        <input
                          type="number"
                          value={expenses.other || ''}
                          onChange={(e) => setExpenses({ ...expenses, other: Number(e.target.value) })}
                          placeholder="0"
                          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none transition"
                          style={{ 
                            borderColor: '#E8E9F0',
                            borderWidth: '1px',
                            color: '#100638'
                          }}
                          onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 2px rgba(0, 189, 152, 0.1), 0 0 0 1px #00BD98'
                          }}
                          onBlur={(e) => {
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <span className="text-sm" style={{ color: '#626477' }}>/month</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg p-4" style={{ backgroundColor: '#F5F6F8', borderRadius: '8px' }}>
                  <p className="text-sm font-medium mb-1" style={{ color: '#100638' }}>Your disposable income</p>
                  <p className="text-2xl font-bold" style={{ color: disposableIncome > 0 ? '#00BD98' : '#E74C3C' }}>
                    {money(Math.max(0, disposableIncome))} per month
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#626477' }}>
                    {money(householdIncome)} - {money(totalMonthlyExpenses)} = {money(Math.max(0, disposableIncome))}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('mortgage_summary')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium transition"
                    style={{ 
                      backgroundColor: '#E8E9F0',
                      color: '#100638'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('results')}
                    disabled={householdIncome <= 0}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    style={{ backgroundColor: householdIncome <= 0 ? '#D1D1D8' : '#100638' }}
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
                  <p className="text-xs font-semibold tracking-wide mb-4" style={{ color: '#626477' }}>YOUR RESULTS</p>
                  <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#100638' }}>
                    You could buy a home worth up to
                  </h1>
                  <div className="text-5xl md:text-6xl font-bold my-6" style={{ color: '#100638' }}>
                    {money(maxPropertyPrice)}
                  </div>
                  <p className="text-lg mb-4" style={{ color: '#626477' }}>
                    vs {money(scenario.price)} for this property
                  </p>
                  <p className="text-sm" style={{ color: isAffordable ? '#00BD98' : '#E74C3C' }}>
                    {isAffordable ? '✓ You can afford this mortgage' : '✗ This mortgage may be stretching'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#626477' }}>Monthly Payment</p>
                    <p className="text-2xl md:text-3xl font-bold" style={{ color: '#100638' }}>{money(monthlyPayment)}</p>
                  </div>
                  <div className="rounded-lg p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#626477' }}>Monthly Income</p>
                    <p className="text-2xl md:text-3xl font-bold" style={{ color: '#100638' }}>{money(monthlyAffordable)}</p>
                  </div>
                  <div className="rounded-lg p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#626477' }}>Remaining Monthly</p>
                    <p className="text-2xl md:text-3xl font-bold" style={{ color: remainingAfterMortgage > 0 ? '#00BD98' : '#E74C3C' }}>{money(remainingAfterMortgage)}</p>
                  </div>
                </div>

                <div className="rounded-lg p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E9F0' }}>
                  <h3 className="font-semibold mb-4" style={{ color: '#100638' }}>Affordability Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#626477' }}>Monthly mortgage payment</span>
                      <strong style={{ color: '#100638' }}>{money(monthlyPayment)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#626477' }}>As % of monthly income</span>
                      <strong style={{ color: '#100638' }}>{affordabilityRatio.toFixed(1)}%</strong>
                    </div>
                    <div className="pt-3" style={{ borderTopColor: '#E8E9F0', borderTopWidth: '1px' }}>
                      <div className="flex justify-between items-center">
                        <span style={{ color: '#626477' }}>Remaining monthly income</span>
                        <strong style={{ color: remainingAfterMortgage > 0 ? '#00BD98' : '#E74C3C' }}>{money(remainingAfterMortgage)}</strong>
                      </div>
                    </div>
                  </div>
                  {affordabilityRatio <= 30 && (
                    <div className="mt-4 p-3 rounded" style={{ backgroundColor: '#E8F7F2' }}>
                      <p className="text-sm font-medium" style={{ color: '#00BD98' }}>✓ Excellent affordability (under 30% of income)</p>
                      <p className="text-xs mt-2" style={{ color: '#626477' }}>Your remaining income comfortably covers living expenses, savings, and emergencies.</p>
                    </div>
                  )}
                  {affordabilityRatio > 30 && affordabilityRatio <= 40 && (
                    <div className="mt-4 p-3 rounded" style={{ backgroundColor: '#E8F7F2' }}>
                      <p className="text-sm font-medium" style={{ color: '#00BD98' }}>✓ Good affordability (30-40% of income)</p>
                      <p className="text-xs mt-2" style={{ color: '#626477' }}>Your remaining income covers living expenses and allows for some savings and unexpected costs.</p>
                    </div>
                  )}
                  {affordabilityRatio > 40 && (
                    <div className="mt-4 p-3 rounded" style={{ backgroundColor: '#FEE8E8' }}>
                      <p className="text-sm font-medium" style={{ color: '#E74C3C' }}>⚠ Tight affordability (over 40% of income)</p>
                      <p className="text-xs mt-2" style={{ color: '#626477' }}>Your remaining income must cover groceries, utilities, transport, insurance, and other living costs. You'll have limited flexibility for savings or emergencies. Consider adjusting your budget or looking at more affordable properties.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('household_income')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium transition"
                    style={{ 
                      backgroundColor: '#E8E9F0',
                      color: '#100638'
                    }}
                  >
                    Edit my details
                  </button>
                  <button
                    onClick={() => router.push('/mortgage-assistant')}
                    className="flex-1 py-3 md:py-4 rounded-lg font-medium text-white hover:opacity-90 transition"
                    style={{ backgroundColor: '#100638' }}
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
