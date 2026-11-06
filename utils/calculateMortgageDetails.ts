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
    monthlyRate === 0
      ? loanAmount / numberOfMonths
      : (loanAmount * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -numberOfMonths))

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
    monthlyPayment,
    totalCost,
    capitalPaid,
    interestPaid,
    remainingBalance,
  }
}
