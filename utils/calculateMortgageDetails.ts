export class MortgageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MortgageValidationError'
  }
}

/**
 * Core mortgage calculation logic
 */
export const calculateMortgageDetails = (
  price: number,
  deposit: number,
  interestRate?: number,
  termYears?: number
) => {
  if (
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > Number.MAX_SAFE_INTEGER / 100
  ) {
    throw new MortgageValidationError('Enter a valid property price greater than zero.')
  }

  if (
    typeof deposit !== 'number' ||
    !Number.isFinite(deposit) ||
    deposit < 0 ||
    deposit > price
  ) {
    throw new MortgageValidationError('Enter a deposit between zero and the property price.')
  }

  if (
    interestRate !== undefined &&
    (typeof interestRate !== 'number' ||
      !Number.isFinite(interestRate) ||
      interestRate < 0 ||
      interestRate > 100)
  ) {
    throw new MortgageValidationError('Enter an annual interest rate between 0% and 100%.')
  }

  if (
    termYears !== undefined &&
    (typeof termYears !== 'number' ||
      !Number.isInteger(termYears) ||
      termYears < 1 ||
      termYears > 40)
  ) {
    throw new MortgageValidationError('Enter a mortgage term of 1 to 40 whole years.')
  }

  if (deposit === price) {
    return {
      fundingType: 'cash' as const,
      purchasePrice: price,
      monthlyPayment: 0,
      totalCost: 0,
      capitalPaid: 0,
      interestPaid: 0,
      remainingBalance: [],
    }
  }

  if (interestRate === undefined) {
    throw new MortgageValidationError('Enter an annual interest rate for your mortgage.')
  }

  if (termYears === undefined) {
    throw new MortgageValidationError('Enter a mortgage term of 1 to 40 whole years.')
  }

  const loanAmount = price - deposit
  const monthlyRate = interestRate / 100 / 12
  const numberOfMonths = termYears * 12

  const monthlyPayment =
    monthlyRate === 0
      ? loanAmount / numberOfMonths
      : (loanAmount * monthlyRate) /
        -Math.expm1(-numberOfMonths * Math.log1p(monthlyRate))

  const totalCost = monthlyRate === 0 ? loanAmount : monthlyPayment * numberOfMonths
  const capitalPaid = loanAmount
  const interestPaid = totalCost - capitalPaid

  let balance = loanAmount
  const remainingBalance = []

  for (let year = 1; year <= termYears; year++) {
    for (let month = 1; month <= 12; month++) {
      balance -= monthlyPayment - balance * monthlyRate

      if (balance <= 0) {
        balance = 0
        break
      }
    }

    remainingBalance.push({
      year,
      balance: Math.max(0, +balance.toFixed(0)),
    })
  }

  return {
    fundingType: 'mortgage' as const,
    purchasePrice: price,
    monthlyPayment,
    totalCost,
    capitalPaid,
    interestPaid,
    remainingBalance,
  }
}
