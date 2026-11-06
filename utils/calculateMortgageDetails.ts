import { calculateRemainingBalance } from './calculateRemainingBalance'

/**
 * Core mortgage calculation logic
 */
export const calculateMortgageDetails = (
  price: number,
  deposit: number,
  interestRate: number,
  termYears: number
) => {
  const loanAmount = price - deposit
  const monthlyRate = interestRate / 100 / 12
  const numberOfMonths = termYears * 12

  const monthlyPayment =
    (loanAmount * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -numberOfMonths))

  const totalCost = monthlyPayment * numberOfMonths
  const capitalPaid = loanAmount
  const interestPaid = totalCost - capitalPaid

  const remainingBalance = calculateRemainingBalance(
    loanAmount,
    monthlyRate,
    termYears
  )

  return {
    monthlyPayment,
    totalCost,
    capitalPaid,
    interestPaid,
    remainingBalance,
  }
}
