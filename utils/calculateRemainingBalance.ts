import { calculateMortgageDetails } from './calculateMortgageDetails'

export function calculateRemainingBalance(
  mortgageAmount: number,
  interestRate: number,
  term: number
) {
  return calculateMortgageDetails(mortgageAmount, 0, interestRate, term)
    .remainingBalance
}
